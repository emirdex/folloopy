const postcss = require('postcss');

// These namespaces belong to account/admin pages, which the public deployment
// redirects to the panel host. Keep shared rules and all animation definitions.
// Match only the first class: never remove a mixed selector or a global reset.
const privateNamespaces = [
  'member-panel-page', 'admin-', 'product-shell', 'product-header',
  'header-actions', 'header-separator', 'workspace-name', 'environment',
  'status-dot', 'global-search', 'app-layout', 'sidebar', 'sidebar-',
  'nav-item', 'nav-current-dot', 'workspace-badge', 'workspace-content',
  'workspace-body', 'workspace-footer', 'service-state', 'breadcrumb',
  'page-heading', 'date-label', 'metric', 'metric-', 'overview-grid',
  'chart', 'chart-', 'connection-card', 'connection-symbols', 'connection-dots',
  'provider-g', 'provider-outlook', 'provider-row', 'provider-description',
  'message-table', 'mail-cell', 'subject-link', 'open-status', 'tracking-label',
  'tracking-on', 'tracking-option', 'tracking-option-', 'row-action',
  'measurement-note', 'section-tabs', 'table-toolbar', 'table-footer',
  'inline-search', 'search-context', 'empty-state', 'empty-icon',
  'record-', 'selected-tab', 'event-', 'stop-form', 'settings-layout',
  'settings-help', 'outlook-row', 'help-point', 'setup-status-grid',
  'activity-layout', 'activity-feed', 'activity-guide', 'feed-', 'guide-note',
  'compose-', 'composer', 'recipient-token', 'toggle', 'search-dialog',
  'dialog-heading', 'refreshing', 'purchase-preview-bar', 'panel-account-actions',
  'opening-summary', 'gmail-channel-glass'
];
// The landing-page FlowDemo also uses these metric tints.
const sharedClasses = new Set(['metric-blue', 'metric-mint', 'metric-peach', 'metric-lilac', 'metric-violet']);

function panelSelector(selector) {
  const firstClass = selector.trim().match(/^\.([a-zA-Z_][\w-]*)/);
  return !!firstClass && !sharedClasses.has(firstClass[1]) && privateNamespaces.some(namespace => namespace.endsWith('-') ? firstClass[1].startsWith(namespace) : firstClass[1] === namespace);
}

function publicCss(source) {
  const root = postcss.parse(source);
  root.walkRules(rule => {
    if (rule.selectors.every(panelSelector)) rule.remove();
  });
  root.walkAtRules(rule => {
    if (rule.nodes && !rule.nodes.length) rule.remove();
  });
  return root.toString();
}

module.exports = function publicCssLoader(source) {
  this.cacheable?.();
  return publicCss(source);
};
module.exports.publicCss = publicCss;
