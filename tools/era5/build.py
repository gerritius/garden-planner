#!/usr/bin/env python3
"""Builds the app's world climate tiles from ERA5 (hourly, 0.25°), so the app needn't ask a weather service for
10 years of records: it downloads the one small tile its garden is in, once.

Source: ERA5 hourly reanalysis on single levels (Copernicus Climate Change Service), as Google's public ARCO-ERA5
copy on Cloud Storage (no account needed). CC BY 4.0 — the app credits it on its Credits page.

For every 0.25° grid point in a 5°×5° tile with any land (Antarctica left out), over the 10 years YEARS, by the
point's own local days (sun time: longitude / 15 hours):
  - the usual mean temperature of each month (mean of the daily means — 24 hourly values a day)
  - the usual rainfall of each month (mm)
  - frost dates from the daily lows, as the app works them out (frostStats in js/climate/climate.js): for each
    winter (July–June north of the equator, January–December south of it) the first and last day the low reached the
    threshold; then how many winters had any, and the median first and last day. Done at seven thresholds, −2…+4 °C:
    the app counts a grid low of +1 °C as a frost (a 28 km grid's lows run about 1 °C warmer than a garden's on clear
    frosty nights — checked against station frost dates), and shifts that for a garden higher or lower than the grid.
  - the grid point's height (m) and land fraction (%)

Output: climate/<tile row>_<tile col>.bin (gzip of little-endian int16), tile row 0 = 90…85° N, col 0 = 0…5° E.
Each tile is 21×21 points (its edges inclusive, so the 4 grid points around any place in it are in it), row by row
from north, and each point has VALUES numbers (see the layout below). A missing tile: all sea.

Usage: python3 tools/era5/build.py [out dir]     (needs numpy and numcodecs; about an hour, mostly downloading)
"""
import concurrent.futures as cf, datetime as dt, gzip, json, os, ssl, sys, time, urllib.request
import numpy as np, numcodecs

YEARS = (2016, 2025)                 # inclusive, whole years
THRESH = (-2, -1, 0, 1, 2, 3, 4)     # frost thresholds (°C, daily low at or below)
TILE, ROWS = 20, 30                  # 5° tiles; rows 0..29 = 90° N .. 60° S
LAYOUT = ['t%d' % m for m in range(12)] + ['rain%d' % m for m in range(12)] + ['elev', 'land', 'winters'] + \
    [f'{k}{j}' for j in range(len(THRESH)) for k in ('frosty', 'first', 'last')]
VALUES = len(LAYOUT)                 # 48
BASE = 'https://storage.googleapis.com/gcp-public-data-arco-era5/ar/full_37-1h-0p25deg-chunk-1.zarr-v3/'
H0 = int((dt.datetime(YEARS[0], 1, 1) - dt.datetime(1900, 1, 1)).total_seconds() // 3600)   # zarr time index
NDAYS = (dt.date(YEARS[1] + 1, 1, 1) - dt.date(YEARS[0], 1, 1)).days
CA = '/root/.ccr/ca-bundle.crt'
ctx = ssl.create_default_context(cafile=CA) if os.path.exists(CA) else ssl.create_default_context()
blosc = numcodecs.Blosc()


def fetch(path, tries=8):
    for i in range(tries):
        try:
            with urllib.request.urlopen(BASE + path, context=ctx, timeout=120) as r:
                return np.frombuffer(blosc.decode(r.read()), '<f4').reshape(721, 1440)
        except Exception as e:  # network hiccups: back off and try again
            if i == tries - 1: raise
            time.sleep(2 ** i)


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else 'climate'
    os.makedirs(out, exist_ok=True)
    lsm, z = fetch(f'land_sea_mask/{H0}.0.0'), fetch(f'geopotential_at_surface/{H0}.0.0')
    lat = 90 - 0.25 * np.arange(721); lon = 0.25 * np.arange(1440)
    tiles = [(ty, tx) for ty in range(ROWS) for tx in range(72)
             if (lsm[TILE * ty:TILE * ty + 21][:, [(TILE * tx + i) % 1440 for i in range(21)]] > 0).any()]
    used = np.zeros((721, 1440), bool)
    for ty, tx in tiles: used[np.ix_(range(TILE * ty, TILE * ty + 21), [(TILE * tx + i) % 1440 for i in range(21)])] = True
    flat = np.flatnonzero(used.ravel()); N = len(flat)
    plat, plon = lat[flat // 1440], lon[flat % 1440]
    off = np.rint(np.where(plon > 180, plon - 360, plon) / 15).astype(int)   # local (sun) time: UTC + off hours
    south = plat < 0
    print(f'{len(tiles)} tiles, {N} points, {NDAYS} days', flush=True)

    days = [dt.date(YEARS[0], 1, 1) + dt.timedelta(d) for d in range(NDAYS)]
    month = np.array([d.month - 1 for d in days])
    # winter of each day and the day's place in it (-1: not in a whole winter of the records)
    wn = np.array([(d.year if d.month >= 7 else d.year - 1) - YEARS[0] for d in days])
    wn_off = np.array([(d - dt.date(d.year if d.month >= 7 else d.year - 1, 7, 1)).days for d in days])
    wn[(wn < 0) | (wn > YEARS[1] - YEARS[0] - 1)] = -1
    ws = np.array([d.year - YEARS[0] for d in days]); ws_off = np.array([d.timetuple().tm_yday - 1 for d in days])
    W = YEARS[1] - YEARS[0] + 1

    tsum = np.zeros((12, N)); tn = np.zeros((12, N)); psum = np.zeros((12, N))
    first = np.full((W, len(THRESH), N), -1, np.int16); last = np.full((W, len(THRESH), N), -1, np.int16)
    cs, cmin, cp, cn = np.zeros(N), np.full(N, np.inf), np.zeros(N), np.zeros(N, np.int16)
    groups = {}   # hours past UTC midnight at which each point's local day ends
    for o in np.unique(off): groups.setdefault((23 - o) % 24, []).append((o, np.flatnonzero(off == o)))

    def hour(h):   # one hour, both variables, at the points we keep (h: hours since the first day, UTC)
        t, p = fetch(f'2m_temperature/{H0 + h}.0.0'), fetch(f'total_precipitation/{H0 + h}.0.0')
        return t.ravel()[flat] - 273.15, np.maximum(p.ravel()[flat], 0) * 1000

    hours = range(-13, int(os.environ.get('QUICK_HOURS', 0)) or NDAYS * 24 + 13)   # (QUICK_HOURS: a short trial run)
    t0 = time.time()
    with cf.ThreadPoolExecutor(64) as ex:
        it = iter(hours); futs = []
        for h in it:
            futs.append((h, ex.submit(hour, h)))
            if len(futs) == 256: break
        k = 0
        while futs:
            h, f = futs.pop(0); t, p = f.result()
            nxt = next(it, None)
            if nxt is not None: futs.append((nxt, ex.submit(hour, nxt)))
            cs += t; np.minimum(cmin, t, out=cmin); cp += p; cn += 1
            for o, idx in groups.get(h % 24, []):   # these points' local day ends with this hour
                d = (h + o) // 24
                ok = idx[cn[idx] == 24] if 0 <= d < NDAYS else idx[:0]
                if len(ok):
                    m = month[d]; tsum[m, ok] += cs[ok] / 24; tn[m, ok] += 1; psum[m, ok] += cp[ok]
                    lo = cmin[ok]
                    for hemi, w, wo in ((~south[ok], wn[d], wn_off[d]), (south[ok], ws[d], ws_off[d])):
                        if w < 0 or not hemi.any(): continue
                        sel, l2 = ok[hemi], lo[hemi]
                        for j, th in enumerate(THRESH):
                            hit = sel[l2 <= th]
                            fresh = hit[first[w, j, hit] < 0]
                            first[w, j, fresh] = wo; last[w, j, hit] = wo
                cs[idx] = 0; cmin[idx] = np.inf; cp[idx] = 0; cn[idx] = 0
            k += 1
            if k % 2000 == 0:
                el = time.time() - t0
                print(f'{k}/{len(hours)} hours, {el / 60:.0f} min, ~{el / k * (len(hours) - k) / 60:.0f} min to go', flush=True)

    # ---- per point: the usual month, the usual frost dates ----
    vals = np.zeros((N, VALUES), np.int16)
    vals[:, 0:12] = np.rint(tsum / np.maximum(tn, 1) * 10).T
    vals[:, 12:24] = np.rint(psum / W).T
    vals[:, 24] = np.rint(z.ravel()[flat] / 9.80665)
    vals[:, 25] = np.rint(lsm.ravel()[flat] * 100)
    winters = np.where(south, W, W - 1)
    vals[:, 26] = winters
    for j in range(len(THRESH)):
        F, L = first[:, j, :].astype(float), last[:, j, :].astype(float)
        hit = F >= 0; n = hit.sum(0)
        Fs = np.sort(np.where(hit, F, np.inf), 0); Ls = np.sort(np.where(hit, L, np.inf), 0)
        pick = np.minimum(n // 2, W - 1)[None]
        mf = np.take_along_axis(Fs, pick, 0)[0]; ml = np.take_along_axis(Ls, pick, 0)[0]
        vals[:, 27 + 3 * j] = n
        vals[:, 28 + 3 * j] = np.where(n > 0, mf, -1)
        vals[:, 29 + 3 * j] = np.where(n > 0, ml, -1)

    pos = np.full(721 * 1440, -1); pos[flat] = np.arange(N)
    for ty, tx in tiles:
        g = (np.arange(TILE * ty, TILE * ty + 21)[:, None] * 1440 + ((TILE * tx + np.arange(21)) % 1440)[None]).ravel()
        with open(os.path.join(out, f'{ty}_{tx}.bin'), 'wb') as f:
            f.write(gzip.compress(vals[pos[g]].astype('<i2').tobytes(), 9, mtime=0))
    with open(os.path.join(out, 'index.json'), 'w') as f:
        json.dump({'source': 'ERA5 hourly (Copernicus Climate Change Service), via ARCO-ERA5', 'years': list(YEARS),
                   'tile': 5, 'points': 21, 'layout': LAYOUT, 'thresholds': THRESH, 'scale': {'t': 0.1},
                   'tiles': sorted(f'{ty}_{tx}' for ty, tx in tiles)}, f, separators=(',', ':'))
    print('done', time.time() - t0, flush=True)


if __name__ == '__main__':
    main()
