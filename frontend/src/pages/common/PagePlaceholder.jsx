/**
 * src/pages/common/PagePlaceholder.jsx
 *
 * Temporary stand-in body for every route in the Phase 1 router so
 * navigation/role-gating can be tested before each real page is built
 * (see PROJECT_HANDOFF.md section 5/6). Delete usages of this as each
 * page gets its real implementation in later phases.
 */

import Card from '../../components/shared/Card';

const PagePlaceholder = ({ title }) => (
  <div className="p-10">
    <Card>
      <h1 className="font-display text-xl text-text">{title}</h1>
      <p className="text-sm text-text-muted mt-1">Not built yet.</p>
    </Card>
  </div>
);

export default PagePlaceholder;
