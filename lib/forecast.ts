import { formatMonth } from "./data";
import type { MonthlyPoint } from "./types";

export type ForecastPoint = {
  month: string;
  label: string;
  actual: number | null;
  forecast: number | null;
  lower: number | null;
  range: number | null;
};

export type ForecastResult = {
  intercept: number;
  slope: number;
  points: ForecastPoint[];
  horizonMonths: number;
};

function addMonths(ym: string, count: number): string {
  const [year, month] = ym.split("-").map(Number);
  const date = new Date(year, month - 1 + count, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function ols(xs: number[], ys: number[]) {
  const n = xs.length;
  const xMean = xs.reduce((sum, x) => sum + x, 0) / n;
  const yMean = ys.reduce((sum, y) => sum + y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - xMean;
    sxx += dx * dx;
    sxy += dx * (ys[i] - yMean);
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = yMean - slope * xMean;
  let sse = 0;
  for (let i = 0; i < n; i += 1) {
    const residual = ys[i] - (intercept + slope * xs[i]);
    sse += residual * residual;
  }
  const residualDf = Math.max(n - 2, 1);
  const sigma = Math.sqrt(sse / residualDf);
  return { intercept, slope, xMean, sxx, n, sigma };
}

function predictionInterval(
  x0: number,
  model: ReturnType<typeof ols>,
  z = 1.96,
): { yhat: number; lower: number; upper: number } {
  const yhat = model.intercept + model.slope * x0;
  const leverage =
    model.sxx === 0 ? 1 / model.n : (x0 - model.xMean) ** 2 / model.sxx;
  const se = model.sigma * Math.sqrt(1 + 1 / model.n + leverage);
  const half = z * se;
  return { yhat, lower: yhat - half, upper: yhat + half };
}

const HORIZON = 6;

export function forecastHeadcount(series: MonthlyPoint[]): ForecastResult | null {
  if (series.length < 3) return null;

  const xs = series.map((_, index) => index);
  const ys = series.map((point) => point.headcount);
  const model = ols(xs, ys);
  const last = series[series.length - 1];

  const historical: ForecastPoint[] = series.map((point, index) => {
    const isLast = index === series.length - 1;
    return {
      month: point.month,
      label: formatMonth(point.month),
      actual: point.headcount,
      forecast: isLast ? point.headcount : null,
      lower: null,
      range: null,
    };
  });

  const future: ForecastPoint[] = [];
  for (let step = 1; step <= HORIZON; step += 1) {
    const x0 = series.length - 1 + step;
    const month = addMonths(last.month, step);
    const interval = predictionInterval(x0, model);
    future.push({
      month,
      label: formatMonth(month),
      actual: null,
      forecast: interval.yhat,
      lower: interval.lower,
      range: Math.max(0, interval.upper - interval.lower),
    });
  }

  return {
    intercept: model.intercept,
    slope: model.slope,
    points: [...historical, ...future],
    horizonMonths: HORIZON,
  };
}
