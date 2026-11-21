// Which copy of the app this is. The test site (…/garden-planner/test/) shares the web address with the real one, so
// it keeps everything separate: its own database, offline copy and settings, and no Google Drive backup — testing
// never touches your real garden or your real backups.

export const SITE = /\/test\/(index\.html)?$/.test(location.pathname) ? 'test' : 'main';
export const IS_TEST = SITE === 'test';
export const DB_NAME = IS_TEST ? 'garden-planner-test' : 'garden-planner';
export const MAIN_DB_NAME = 'garden-planner';
// a key in this browser's local storage, kept apart per site
export const lsKey = k => (IS_TEST ? 'gp.test.' : 'gp.') + k;
