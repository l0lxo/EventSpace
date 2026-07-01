import { useEffect, useState } from 'react';
import { format, subMonths, startOfMonth } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  Legend,
} from 'recharts';
import api from '../../utils/api';
import Card from '../../components/shared/Card';
import { formatKES } from '../../utils/formatCurrency';

// Design-system hex values — SVG fill attributes don't resolve CSS custom properties
const C_ACCENT  = '#CDDDE7';
const C_SUCCESS = '#1A7F37';
const C_WARNING = '#9A6700';
const C_BORDER  = '#E0E0E0';
const C_MUTED   = '#666666';

const defaultStart = () => format(startOfMonth(subMonths(new Date(), 5)), 'yyyy-MM-dd');
const defaultEnd   = () => format(new Date(), 'yyyy-MM-dd');

const SummaryCard = ({ label, value, sublines = [], valueClassName = 'text-text' }) => (
  <Card>
    <p className="text-xs font-medium text-text-muted uppercase tracking-wide">{label}</p>
    <p className={`text-2xl font-mono mt-2 ${valueClassName}`}>{value ?? '—'}</p>
    {sublines.length > 0 && (
      <div className="mt-2 space-y-0.5">
        {sublines.map(({ label: sub, value: val }) => (
          <p key={sub} className="text-xs text-text-muted">
            <span className="font-mono">{val}</span> {sub}
          </p>
        ))}
      </div>
    )}
  </Card>
);

const ChartSkeleton = ({ height = 320 }) => (
  <div className="bg-white border border-border rounded-md p-5" aria-hidden="true">
    <div className="w-1/3 h-4 bg-border rounded-sm mb-5 animate-skeleton-pulse" />
    <div className="w-full bg-border rounded-sm animate-skeleton-pulse" style={{ height: height - 64 }} />
  </div>
);

const Empty = ({ message, height = 260 }) => (
  <div className="flex items-center justify-center text-text-muted text-sm" style={{ height }}>
    {message}
  </div>
);

const DateRangeSelector = ({ startId, endId, startValue, endValue, onStartChange, onEndChange }) => (
  <div className="flex flex-wrap items-center gap-3 mb-6">
    <span className="text-sm font-medium text-text">Date range</span>
    <div className="flex items-center gap-2">
      <label className="text-sm text-text-muted" htmlFor={startId}>From</label>
      <input
        id={startId}
        type="date"
        value={startValue}
        onChange={(e) => onStartChange(e.target.value)}
        className="text-sm border border-border rounded-sm px-2 py-1 text-text bg-white"
      />
    </div>
    <div className="flex items-center gap-2">
      <label className="text-sm text-text-muted" htmlFor={endId}>To</label>
      <input
        id={endId}
        type="date"
        value={endValue}
        onChange={(e) => onEndChange(e.target.value)}
        className="text-sm border border-border rounded-sm px-2 py-1 text-text bg-white"
      />
    </div>
  </div>
);

const TOOLTIP_STYLE = { fontSize: 12, borderColor: C_BORDER };
const LEGEND_STYLE  = { fontSize: 11 };

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');

  // Overview tab
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate,   setEndDate]   = useState(defaultEnd);
  const [analytics,        setAnalytics]        = useState(null);
  const [participation,    setParticipation]    = useState(null);
  const [analyticsErr,     setAnalyticsErr]     = useState('');
  const [participationErr, setParticipationErr] = useState('');

  // Financials tab
  const [finStartDate, setFinStartDate] = useState(defaultStart);
  const [finEndDate,   setFinEndDate]   = useState(defaultEnd);
  const [financials,    setFinancials]    = useState(null);
  const [financialsErr, setFinancialsErr] = useState('');

  useEffect(() => {
    let active = true;
    setAnalytics(null);
    setAnalyticsErr('');
    api
      .get('/admin/analytics', { params: { startDate, endDate } })
      .then(({ data }) => { if (active) setAnalytics(data); })
      .catch(() => { if (active) setAnalyticsErr('Could not load analytics.'); });
    return () => { active = false; };
  }, [startDate, endDate]);

  useEffect(() => {
    let active = true;
    api
      .get('/admin/reports/participation')
      .then(({ data }) => { if (active) setParticipation(data.data); })
      .catch(() => { if (active) setParticipationErr('Could not load participation data.'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setFinancials(null);
    setFinancialsErr('');
    api
      .get('/admin/financials', { params: { startDate: finStartDate, endDate: finEndDate } })
      .then(({ data }) => { if (active) setFinancials(data); })
      .catch(() => { if (active) setFinancialsErr('Could not load financial data.'); });
    return () => { active = false; };
  }, [finStartDate, finEndDate]);

  // Overview derived data
  const fillRateByCategory = participation
    ? (() => {
        const groups = {};
        for (const ev of participation) {
          if (!groups[ev.category]) groups[ev.category] = { total: 0, n: 0 };
          const rate = ev.capacity > 0 ? (ev.totalBookings / ev.capacity) * 100 : 0;
          groups[ev.category].total += rate;
          groups[ev.category].n += 1;
        }
        return Object.entries(groups)
          .map(([category, { total, n }]) => ({ category, fillRate: Math.round(total / n) }))
          .sort((a, b) => b.fillRate - a.fillRate);
      })()
    : null;

  const today = new Date();
  const upcomingByCategory = participation
    ? (() => {
        const counts = {};
        for (const ev of participation) {
          if (new Date(ev.date) >= today) {
            counts[ev.category] = (counts[ev.category] || 0) + 1;
          }
        }
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
      })()
    : null;

  // Financials derived data
  const revenueVsFunding = financials
    ? financials.revenueOverTime.map((r, i) => ({
        month: r.month,
        revenue: r.amount,
        funding: financials.fundingOverTime[i]?.amount ?? 0,
      }))
    : null;

  const categoryFinancials = financials
    ? (() => {
        const cats = new Set([
          ...financials.revenueByCategory.map((c) => c.category),
          ...financials.fundingByCategory.map((c) => c.category),
        ]);
        return Array.from(cats)
          .map((cat) => ({
            category: cat,
            revenue: financials.revenueByCategory.find((c) => c.category === cat)?.totalRevenue ?? 0,
            funding: financials.fundingByCategory.find((c) => c.category === cat)?.totalFunding ?? 0,
          }))
          .sort((a, b) => (b.revenue + b.funding) - (a.revenue + a.funding));
      })()
    : null;

  const analyticsLoading    = !analytics    && !analyticsErr;
  const participationLoading = !participation && !participationErr;
  const financialsLoading   = !financials   && !financialsErr;

  const tabBtn = (tab, label) => (
    <button
      type="button"
      onClick={() => setActiveTab(tab)}
      className={`px-4 py-2 text-sm font-medium rounded-sm border transition-colors ${
        activeTab === tab
          ? 'bg-accent text-on-accent border-accent'
          : 'bg-white text-text border-border hover:bg-surface'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="p-4 sm:p-10">
      <h1 className="font-display text-2xl text-text mb-6">Admin Dashboard</h1>

      {/* ── Top summary cards (always visible) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          label="Total Events"
          value={analytics?.totalEvents}
          sublines={analytics ? [
            { label: 'pending',  value: analytics.eventsByStatus.pending },
            { label: 'approved', value: analytics.eventsByStatus.approved },
          ] : []}
        />
        <SummaryCard label="Confirmed Bookings" value={analytics?.totalBookings} />
        <SummaryCard
          label="Registered Users"
          value={analytics?.totalUsers}
          sublines={analytics ? [
            { label: 'students',   value: analytics.usersByRole.student },
            { label: 'organizers', value: analytics.usersByRole.organizer },
          ] : []}
        />
        <SummaryCard label="Upcoming Events" value={analytics?.upcomingEventsCount} />
      </div>

      {/* ── Tab switcher ── */}
      <div className="flex gap-2 mb-6">
        {tabBtn('overview',   'Overview')}
        {tabBtn('financials', 'Financials')}
      </div>

      {/* ════════════════════ OVERVIEW TAB ════════════════════ */}
      {activeTab === 'overview' && (
        <>
          <DateRangeSelector
            startId="dash-start"
            endId="dash-end"
            startValue={startDate}
            endValue={endDate}
            onStartChange={setStartDate}
            onEndChange={setEndDate}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Chart 1 — Events by month */}
            {analyticsLoading ? (
              <ChartSkeleton height={320} />
            ) : analyticsErr ? (
              <Card><p className="text-sm text-danger">{analyticsErr}</p></Card>
            ) : (
              <Card>
                <h2 className="font-display text-base text-text mb-4">Events by Month</h2>
                {!analytics.eventsOverTime?.length ? (
                  <Empty message="No events in this period" height={260} />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={analytics.eventsOverTime}
                      margin={{ top: 4, right: 12, bottom: 28, left: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={C_BORDER} vertical={false} />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 10, fill: C_MUTED }}
                        angle={-35}
                        textAnchor="end"
                        interval={0}
                      />
                      <YAxis tick={{ fontSize: 11, fill: C_MUTED }} allowDecimals={false} />
                      <Tooltip formatter={(v) => [v, 'Events']} contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="count" fill={C_ACCENT} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            )}

            {/* Chart 2 — Events by category */}
            {analyticsLoading ? (
              <ChartSkeleton height={320} />
            ) : analyticsErr ? null : (
              <Card>
                <h2 className="font-display text-base text-text mb-4">Events by Category</h2>
                {!analytics.popularCategories?.length ? (
                  <Empty message="No approved events yet" height={260} />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      layout="vertical"
                      data={analytics.popularCategories}
                      margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={C_BORDER} horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: C_MUTED }} allowDecimals={false} />
                      <YAxis
                        dataKey="category"
                        type="category"
                        tick={{ fontSize: 10, fill: C_MUTED }}
                        width={100}
                      />
                      <Tooltip formatter={(v) => [v, 'Events']} contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="eventCount" fill={C_ACCENT} radius={[0, 2, 2, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            )}

            {/* Chart 3 — Average fill rate by category */}
            {participationLoading ? (
              <ChartSkeleton height={300} />
            ) : participationErr ? (
              <Card><p className="text-sm text-danger">{participationErr}</p></Card>
            ) : (
              <Card>
                <h2 className="font-display text-base text-text mb-4">Average Fill Rate by Category</h2>
                {!fillRateByCategory?.length ? (
                  <Empty message="No participation data yet" height={240} />
                ) : (
                  <>
                    <div className="flex items-center gap-4 mb-3">
                      <span className="flex items-center gap-1.5 text-xs text-text-muted">
                        <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: C_SUCCESS }} />
                        ≥ 70% (well attended)
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-text-muted">
                        <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: C_WARNING }} />
                        &lt; 70%
                      </span>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        layout="vertical"
                        data={fillRateByCategory}
                        margin={{ top: 4, right: 40, bottom: 4, left: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={C_BORDER} horizontal={false} />
                        <XAxis
                          type="number"
                          domain={[0, 100]}
                          tickFormatter={(v) => `${v}%`}
                          tick={{ fontSize: 11, fill: C_MUTED }}
                        />
                        <YAxis
                          dataKey="category"
                          type="category"
                          tick={{ fontSize: 10, fill: C_MUTED }}
                          width={100}
                        />
                        <Tooltip
                          formatter={(v) => [`${v}%`, 'Avg fill rate']}
                          contentStyle={TOOLTIP_STYLE}
                        />
                        <ReferenceLine
                          x={70}
                          stroke={C_MUTED}
                          strokeDasharray="4 2"
                          label={{ value: '70%', position: 'right', fontSize: 10, fill: C_MUTED }}
                        />
                        <Bar dataKey="fillRate" radius={[0, 2, 2, 0]}>
                          {fillRateByCategory.map((entry, idx) => (
                            <Cell key={idx} fill={entry.fillRate >= 70 ? C_SUCCESS : C_WARNING} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </>
                )}
              </Card>
            )}

            {/* Chart 4 — Upcoming events by category */}
            {participationLoading ? (
              <ChartSkeleton height={300} />
            ) : participationErr ? null : (
              <Card>
                <h2 className="font-display text-base text-text mb-4">Upcoming Events by Category</h2>
                {!upcomingByCategory?.length ? (
                  <Empty message="No upcoming events" height={260} />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      layout="vertical"
                      data={upcomingByCategory}
                      margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={C_BORDER} horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: C_MUTED }} allowDecimals={false} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        tick={{ fontSize: 10, fill: C_MUTED }}
                        width={100}
                      />
                      <Tooltip formatter={(v) => [v, 'Upcoming events']} contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="value" fill={C_ACCENT} radius={[0, 2, 2, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            )}

          </div>
        </>
      )}

      {/* ════════════════════ FINANCIALS TAB ════════════════════ */}
      {activeTab === 'financials' && (
        <>
          {/* Financial summary cards */}
          {financialsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {[1, 2, 3].map((n) => (
                <div key={n} className="bg-white border border-border rounded-md p-5 h-20 animate-skeleton-pulse" />
              ))}
            </div>
          ) : financialsErr ? (
            <Card className="mb-8"><p className="text-sm text-danger">{financialsErr}</p></Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <SummaryCard label="Total Revenue" value={formatKES(financials.totalRevenue)} />
              <SummaryCard label="Total Funding Committed" value={formatKES(financials.totalFunding)} />
              <SummaryCard
                label="Net Position"
                value={formatKES(financials.netPosition)}
                valueClassName={financials.netPosition >= 0 ? 'text-success' : 'text-danger'}
              />
            </div>
          )}

          <DateRangeSelector
            startId="fin-start"
            endId="fin-end"
            startValue={finStartDate}
            endValue={finEndDate}
            onStartChange={setFinStartDate}
            onEndChange={setFinEndDate}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Fin Chart 1 — Revenue by month */}
            {financialsLoading ? (
              <ChartSkeleton height={320} />
            ) : financialsErr ? (
              <Card><p className="text-sm text-danger">{financialsErr}</p></Card>
            ) : (
              <Card>
                <h2 className="font-display text-base text-text mb-4">Revenue by Month (KES)</h2>
                {!financials.revenueOverTime?.length ? (
                  <Empty message="No revenue in this period" height={260} />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={financials.revenueOverTime}
                      margin={{ top: 4, right: 12, bottom: 28, left: 70 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={C_BORDER} vertical={false} />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 10, fill: C_MUTED }}
                        angle={-35}
                        textAnchor="end"
                        interval={0}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: C_MUTED }}
                        tickFormatter={(v) => formatKES(v)}
                        width={90}
                      />
                      <Tooltip formatter={(v) => [formatKES(v), 'Revenue']} contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="amount" fill={C_SUCCESS} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            )}

            {/* Fin Chart 2 — Funding by month */}
            {financialsLoading ? (
              <ChartSkeleton height={320} />
            ) : financialsErr ? null : (
              <Card>
                <h2 className="font-display text-base text-text mb-4">Funding Committed by Month (KES)</h2>
                {!financials.fundingOverTime?.length ? (
                  <Empty message="No funding in this period" height={260} />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={financials.fundingOverTime}
                      margin={{ top: 4, right: 12, bottom: 28, left: 70 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={C_BORDER} vertical={false} />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 10, fill: C_MUTED }}
                        angle={-35}
                        textAnchor="end"
                        interval={0}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: C_MUTED }}
                        tickFormatter={(v) => formatKES(v)}
                        width={90}
                      />
                      <Tooltip formatter={(v) => [formatKES(v), 'Funding']} contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="amount" fill={C_WARNING} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            )}

            {/* Fin Chart 3 — Revenue vs Funding over time */}
            {financialsLoading ? (
              <ChartSkeleton height={320} />
            ) : financialsErr ? null : (
              <Card>
                <h2 className="font-display text-base text-text mb-4">Revenue vs Funding (KES)</h2>
                {!revenueVsFunding?.length ? (
                  <Empty message="No data in this period" height={260} />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={revenueVsFunding}
                      margin={{ top: 4, right: 12, bottom: 28, left: 70 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={C_BORDER} vertical={false} />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 10, fill: C_MUTED }}
                        angle={-35}
                        textAnchor="end"
                        interval={0}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: C_MUTED }}
                        tickFormatter={(v) => formatKES(v)}
                        width={90}
                      />
                      <Tooltip
                        formatter={(v, name) => [formatKES(v), name === 'revenue' ? 'Revenue' : 'Funding']}
                        contentStyle={TOOLTIP_STYLE}
                      />
                      <Legend
                        formatter={(val) => (val === 'revenue' ? 'Revenue' : 'Funding')}
                        wrapperStyle={LEGEND_STYLE}
                      />
                      <Bar dataKey="revenue" fill={C_SUCCESS} radius={[2, 2, 0, 0]} />
                      <Bar dataKey="funding" fill={C_WARNING} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            )}

            {/* Fin Chart 4 — Revenue & Funding by category */}
            {financialsLoading ? (
              <ChartSkeleton height={320} />
            ) : financialsErr ? null : (
              <Card>
                <h2 className="font-display text-base text-text mb-4">Revenue &amp; Funding by Category (KES)</h2>
                {!categoryFinancials?.length ? (
                  <Empty message="No financial data by category" height={260} />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      layout="vertical"
                      data={categoryFinancials}
                      margin={{ top: 4, right: 16, bottom: 16, left: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={C_BORDER} horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10, fill: C_MUTED }}
                        tickFormatter={(v) => formatKES(v)}
                      />
                      <YAxis
                        dataKey="category"
                        type="category"
                        tick={{ fontSize: 10, fill: C_MUTED }}
                        width={100}
                      />
                      <Tooltip
                        formatter={(v, name) => [formatKES(v), name === 'revenue' ? 'Revenue' : 'Funding']}
                        contentStyle={TOOLTIP_STYLE}
                      />
                      <Legend
                        formatter={(val) => (val === 'revenue' ? 'Revenue' : 'Funding')}
                        wrapperStyle={LEGEND_STYLE}
                      />
                      <Bar dataKey="revenue" fill={C_SUCCESS} radius={[0, 2, 2, 0]} />
                      <Bar dataKey="funding" fill={C_WARNING} radius={[0, 2, 2, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            )}

          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
