'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const PRIMARY = '#0d6efd';
const SUCCESS = '#198754';
const WARN = '#ffc107';
const DANGER = '#dc3545';
const MUTED = '#6c757d';

type StatusPoint = { name: string; value: number; key: 'ok' | 'baixo' | 'zerado' };
type ConsumptionPoint = { name: string; items: number };

type Props = {
  status: StatusPoint[];
  consumption: ConsumptionPoint[];
  periodLabel?: string;
};

function statusColor(key: StatusPoint['key']) {
  if (key === 'ok') return SUCCESS;
  if (key === 'baixo') return WARN;
  return DANGER;
}

export function StockConsumptionCharts({
  status,
  consumption,
  periodLabel = 'Ultimos 30 dias',
}: Props) {
  const hasStatus = status.some((s) => s.value > 0);
  const hasConsumption = consumption.some((c) => c.items > 0);

  return (
    <section className="dash-charts" aria-label="Graficos de estoque e consumo">
      <div className="dash-panel">
        <div className="dash-panel__head">
          <h2>Situacao dos saldos</h2>
          <p>Linhas OK, baixas e zeradas</p>
        </div>
        <div className="dash-panel__body">
          {!hasStatus ? (
            <p className="dash-panel__empty">Sem saldos para exibir.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={status} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: MUTED, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: MUTED, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(13, 110, 253, 0.06)' }}
                  contentStyle={{
                    borderRadius: 6,
                    border: '1px solid #dee2e6',
                    fontSize: 13,
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
                  {status.map((entry) => (
                    <Cell key={entry.key} fill={statusColor(entry.key)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="dash-panel">
        <div className="dash-panel__head">
          <h2>Consumo recente</h2>
          <p>Itens entregues por setor · {periodLabel}</p>
        </div>
        <div className="dash-panel__body">
          {!hasConsumption ? (
            <p className="dash-panel__empty">
              Sem entregas no periodo para montar o consumo.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={consumption}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fill: MUTED, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={96}
                  tick={{ fill: MUTED, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(13, 110, 253, 0.06)' }}
                  contentStyle={{
                    borderRadius: 6,
                    border: '1px solid #dee2e6',
                    fontSize: 13,
                  }}
                />
                <Bar dataKey="items" name="Itens" fill={PRIMARY} radius={[0, 4, 4, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </section>
  );
}
