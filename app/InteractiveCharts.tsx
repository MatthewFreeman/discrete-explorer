"use client";

import { useState, type ReactNode } from "react";
import emissionData from "@/data/emission-decade.json";
import type { LiveChainSnapshot, LiveChainState } from "./live-chain";

type YearData = (typeof emissionData.years)[number];
export type ChartOverlay = "unlocked" | "reward";

const formatNumber = (value: string | number, digits = 2) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value));

const formatInteger = (value: string | number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    Number(value),
  );

const formatCompact = (value: string | number) => {
  const number = Number(value);
  if (number === 0) return "0";
  if (Math.abs(number) >= 1_000_000) {
    return `${(number / 1_000_000).toFixed(Math.abs(number) >= 10_000_000 ? 1 : 2)}M`;
  }
  if (Math.abs(number) >= 1_000) {
    return `${(number / 1_000).toFixed(Math.abs(number) >= 100_000 ? 0 : 1)}K`;
  }
  return formatNumber(number);
};

const niceCeiling = (value: number) => {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step =
    [1, 1.1, 1.25, 1.5, 2, 2.5, 5, 10].find(
      (candidate) => candidate >= normalized,
    ) ?? 10;
  return step * magnitude;
};

const niceBounds = (minimum: number, maximum: number) => {
  const range = Math.max(maximum - minimum, Math.abs(maximum) * 0.01, 0.01);
  const roughStep = range / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const niceStep =
    ([1, 2, 2.5, 5, 10].find((candidate) => candidate >= normalized) ?? 10) *
    magnitude;
  return {
    minimum: Math.max(0, Math.floor((minimum - range * 0.02) / niceStep) * niceStep),
    maximum: Math.ceil((maximum + range * 0.02) / niceStep) * niceStep,
  };
};

const linePath = (points: Array<{ x: number; y: number }>) =>
  points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

const liveDateLabel = (snapshot: LiveChainSnapshot) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(snapshot.tipTimestamp));

type LiveControl = {
  active: boolean;
  detail: string;
  disabled: boolean;
  label: string;
  onClick: () => void;
};

function MonthNavigator({
  id,
  label,
  value,
  period,
  onChange,
  liveControl,
}: {
  id: string;
  label: string;
  value: number;
  period: string;
  onChange: (index: number) => void;
  liveControl: LiveControl;
}) {
  return (
    <div
      className="month-navigator"
      role="group"
      aria-label={`${label} protocol month navigation`}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value === 0}
        aria-label="Select previous protocol month"
      >
        ← <span>Previous</span>
      </button>
      <div className="month-navigator-center">
        <label className="month-navigator-current" htmlFor={id}>
          <span>Protocol month</span>
          <select
            id={id}
            value={value}
            aria-label={`Select ${label.toLowerCase()} protocol month`}
            aria-describedby={`${id}-period`}
            onChange={(event) => onChange(Number(event.target.value))}
          >
            {Array.from({ length: 12 }, (_, index) => (
              <option key={index} value={index}>
                M{index + 1} of 12
              </option>
            ))}
          </select>
          <small id={`${id}-period`} title={period}>{period}</small>
        </label>
        <button
          className="today-button"
          type="button"
          data-active={liveControl.active}
          aria-pressed={liveControl.active}
          disabled={liveControl.disabled}
          onClick={liveControl.onClick}
        >
          <span>{liveControl.label}</span>
          <small>{liveControl.detail}</small>
        </button>
      </div>
      <button
        type="button"
        onClick={() => onChange(Math.min(11, value + 1))}
        disabled={value === 11}
        aria-label="Select next protocol month"
      >
        <span>Next</span> →
      </button>
    </div>
  );
}

export function CombinedEmissionChart({
  year,
  selectedIndex,
  onSelect,
  lineMetric,
  onLineMetricChange,
  yearControls,
  liveTip,
  liveStatus,
  onSelectToday,
  onRefreshLive,
}: {
  year: YearData;
  selectedIndex: number;
  onSelect: (index: number) => void;
  lineMetric: ChartOverlay;
  onLineMetricChange: (metric: ChartOverlay) => void;
  yearControls: ReactNode;
  liveTip: LiveChainSnapshot | null;
  liveStatus: LiveChainState["status"];
  onSelectToday: () => void;
  onRefreshLive: () => void;
}) {
  const rows = year.months;
  const treasuryTotal = Number(emissionData.meta.treasuryReserve.totalXds);
  const width = 1_020;
  const left = 84;
  const right = 104;
  const top = 58;
  const bottom = 338;
  const plotHeight = bottom - top;
  const plotWidth = width - left - right;
  const step = plotWidth / rows.length;
  const monthlyFlowValues = rows.map(
    (row) =>
      Number(row.minedXds) + Number(row.treasuryUnlockEnteringMonthXds),
  );
  const hasTreasuryUnlockThisYear = rows.some(
    (row) => Number(row.treasuryUnlockEnteringMonthXds) > 0,
  );
  const treasuryFullyUnlockedAtYearStart =
    Number(year.treasuryUnlockedStartXds) === treasuryTotal;
  const issuanceMax = niceCeiling(Math.max(...monthlyFlowValues) * 1.04);
  const issuanceY = (value: number) =>
    bottom - (value / issuanceMax) * plotHeight;
  const overlayValues =
    lineMetric === "unlocked"
      ? [
          Number(year.supplyStartXds) -
            treasuryTotal +
            Number(year.treasuryUnlockedStartXds),
          ...rows.map(
            (row) =>
              Number(row.cumulativeMinedXds) +
              Number(row.treasuryUnlockedStartXds),
          ),
        ]
      : [Number(rows[0].rewardStartXds), ...rows.map((row) => Number(row.rewardEndXds))];
  const overlayRawMin = Math.min(...overlayValues);
  const overlayRawMax = Math.max(...overlayValues);
  const overlayBounds = niceBounds(overlayRawMin, overlayRawMax);
  const overlayMin = overlayBounds.minimum;
  const overlayMax = overlayBounds.maximum;
  const overlayY = (value: number) =>
    bottom - ((value - overlayMin) / (overlayMax - overlayMin)) * plotHeight;
  const overlayPoints = overlayValues.map((value, index) => ({
    x: index === 0 ? left : left + step * (index - 0.5),
    y: overlayY(value),
  }));
  const displayedOverlayPoints = overlayPoints.slice(1);
  const overlayPath = linePath(displayedOverlayPoints);
  const overlayArea = `${overlayPath} L ${displayedOverlayPoints[displayedOverlayPoints.length - 1].x} ${bottom} L ${displayedOverlayPoints[0].x} ${bottom} Z`;
  const selectedPoint = overlayPoints[selectedIndex + 1];

  const blockX = (blockHeight: number) => {
    if (blockHeight < year.blockStart || blockHeight > year.blockEnd) return null;
    return (
      left +
      ((blockHeight - year.blockStart + 1) / year.blocks) * plotWidth
    );
  };
  const liveX =
    liveTip && liveTip.yearIndex === year.year - 1
      ? blockX(liveTip.tipHeight)
      : null;
  const liveOverlayValue = liveTip
    ? Number(
        lineMetric === "reward"
          ? liveTip.nextRewardXds
          : liveTip.minedPlusScheduledUnlockedXds,
      )
    : null;
  const liveOverlayY =
    liveX !== null && liveOverlayValue !== null
      ? Math.max(top, Math.min(bottom, overlayY(liveOverlayValue)))
      : null;
  const liveMarkerLabelX =
    liveX === null
      ? left
      : Math.max(left + 4, Math.min(liveX + 7, width - right - 112));
  const liveControl: LiveControl = liveTip
    ? liveTip.withinModel
      ? {
          active:
            liveTip.yearIndex === year.year - 1 && liveTip.monthIndex === selectedIndex,
          detail: `${liveDateLabel(liveTip)} · H ${formatInteger(liveTip.tipHeight)}`,
          disabled: false,
          label: "Today",
          onClick: onSelectToday,
        }
      : {
          active: false,
          detail: "Outside 10-year model",
          disabled: true,
          label: "Today",
          onClick: onSelectToday,
        }
    : {
        active: false,
        detail: liveStatus === "error" ? "RPC unavailable" : "Connecting to RPC",
        disabled: liveStatus !== "error",
        label: liveStatus === "error" ? "Retry live" : "Today",
        onClick: onRefreshLive,
      };

  const equalityStart = blockX(emissionData.meta.tailAtLeastBase.blockHeight);
  const equalityEnd = blockX(emissionData.meta.tailStrictlyHigher.blockHeight - 1);
  const eventMarkers = [
    {
      block: emissionData.meta.tailStrictlyHigher.blockHeight,
      label: "TAIL > BASE",
      kind: "tail",
      labelSide: "left",
      labelY: top + 29,
    },
    {
      block: emissionData.meta.minimumEffectiveReward.lastBlock + 1,
      label: "REWARD RISES",
      kind: "rise",
      labelSide: "right",
      labelY: top + 14,
    },
    {
      block: emissionData.meta.targetSupplyCrossing.blockHeight,
      label: "21M CROSSED",
      kind: "target",
      labelSide: "left",
      labelY: top + 14,
    },
  ].flatMap((marker) => {
    const x = blockX(marker.block);
    return x === null ? [] : [{ ...marker, x }];
  });

  const rightAxisLabel =
    lineMetric === "unlocked"
      ? "Mined through month + Treasury at month start · XDS"
      : "Block reward · XDS / block";
  const overlayDefinitions: Array<{ metric: ChartOverlay; text: string }> = [
    {
      metric: "unlocked",
      text: `The main line combines miner issuance through each month with Treasury available from that month’s first block. This is not circulating supply or a holder balance.${treasuryFullyUnlockedAtYearStart ? " The reserve was fully scheduled unlocked before this year." : ""}`,
    },
    {
      metric: "reward",
      text: "The main line shows reward on the final block of each protocol month, assuming no block-size penalty.",
    },
  ];
  const mobileWidth = 360;
  const mobileLeft = 32;
  const mobileRight = 32;
  const mobileTop = 24;
  const mobileBottom = 206;
  const mobilePlotHeight = mobileBottom - mobileTop;
  const mobilePlotWidth = mobileWidth - mobileLeft - mobileRight;
  const mobileStep = mobilePlotWidth / rows.length;
  const mobileIssuanceY = (value: number) =>
    mobileBottom - (value / issuanceMax) * mobilePlotHeight;
  const mobileOverlayY = (value: number) =>
    mobileBottom -
    ((value - overlayMin) / (overlayMax - overlayMin)) * mobilePlotHeight;
  const mobileOverlayPoints = overlayValues.map((value, index) => ({
    x: index === 0 ? mobileLeft : mobileLeft + mobileStep * (index - 0.5),
    y: mobileOverlayY(value),
  }));
  const mobileSelectedPoint = mobileOverlayPoints[selectedIndex + 1];
  const mobileDisplayedOverlayPoints = mobileOverlayPoints.slice(1);
  const mobileOverlayPath = linePath(mobileDisplayedOverlayPoints);
  const mobileBlockX = (blockHeight: number) => {
    if (blockHeight < year.blockStart || blockHeight > year.blockEnd) return null;
    return (
      mobileLeft +
      ((blockHeight - year.blockStart + 1) / year.blocks) * mobilePlotWidth
    );
  };
  const mobileEventMarkers = eventMarkers.map((marker) => ({
    ...marker,
    x: mobileBlockX(marker.block) ?? mobileLeft,
  }));
  const valueLabelWidth = 76;
  const valueLabelHeight = 24;
  const selectedOverlayLabelX = Math.min(
    selectedPoint.x + 8,
    width - right - valueLabelWidth,
  );
  const selectedOverlayLabelY = Math.max(
    top,
    Math.min(bottom - valueLabelHeight, selectedPoint.y - 14),
  );
  return (
    <section className="combined-chart" id="unified-chart" aria-labelledby="combined-chart-heading" tabIndex={-1}>
      <div className="combined-chart-head">
        <div>
          <h3 id="combined-chart-heading">Monthly protocol dynamics</h3>
          <p>Stacked bars add any Treasury batch available from that month’s first block to miner issuance. Choose the cumulative emission subtotal or block reward for the right-axis line.</p>
        </div>
        <fieldset className="line-metric-toggle" aria-describedby="line-overlay-definition">
          <legend>Main right-axis line</legend>
          <button
            type="button"
            data-selected={lineMetric === "unlocked"}
            aria-pressed={lineMetric === "unlocked"}
            onClick={() => onLineMetricChange("unlocked")}
          >
            Mined + scheduled unlocked
          </button>
          <button
            type="button"
            data-selected={lineMetric === "reward"}
            aria-pressed={lineMetric === "reward"}
            onClick={() => onLineMetricChange("reward")}
          >
            Block reward
          </button>
        </fieldset>
      </div>

      <div className="active-legend" aria-label="Active chart series">
        <span><i className="legend-swatch bars miner" /> Miner issuance</span>
        <span>
          <i className="legend-swatch bars unlock" />
          {hasTreasuryUnlockThisYear ? "Unlock entering month" : "No Treasury unlocks enter this year"}
        </span>
        <span className="line-legend-item">
          <i className={`legend-swatch line ${lineMetric}`} />
          <span className="line-legend-labels">
            <span aria-hidden={lineMetric !== "unlocked"} data-active={lineMetric === "unlocked"}>
              Mined + scheduled unlocked · XDS
            </span>
            <span aria-hidden={lineMetric !== "reward"} data-active={lineMetric === "reward"}>
              Block reward · XDS / block
            </span>
          </span>
        </span>
        <span className="scale-note">
          Left: monthly stacked flow · Right: selected line
        </span>
      </div>
      <p
        className={`overlay-definition ${lineMetric}`}
        id="line-overlay-definition"
        aria-live="polite"
      >
        <span className="overlay-definition-copies">
          {overlayDefinitions.map((definition) => (
            <span
              aria-hidden={definition.metric !== lineMetric}
              data-active={definition.metric === lineMetric}
              key={definition.metric}
            >
              Amber caps use the same monthly XDS scale as miner issuance. {definition.text}
            </span>
          ))}
        </span>
      </p>

      {yearControls}

      <div className="chart-viewport desktop-chart-viewport" tabIndex={0} aria-label="Monthly protocol chart">
        <svg
          className="combined-chart-svg"
          viewBox={`0 0 ${width} 398`}
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient id="combined-supply-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#c7d2d7" stopOpacity="0.1" />
              <stop offset="1" stopColor="#c7d2d7" stopOpacity="0" />
            </linearGradient>
          </defs>

          <text className="axis-title" x={left} y={22}>MONTHLY MINED + UNLOCK ENTERING MONTH · XDS</text>
          <text className={`axis-title right ${lineMetric}`} x={width - right} y={22} textAnchor="end">
            {rightAxisLabel.toUpperCase()}
          </text>

          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = bottom - ratio * plotHeight;
            const issuanceTick = issuanceMax * ratio;
            const overlayTick = overlayMin + (overlayMax - overlayMin) * ratio;
            return (
              <g key={ratio}>
                <line className="grid-line" x1={left} x2={width - right} y1={y} y2={y} />
                <text className="axis-text" x={left - 12} y={y + 4} textAnchor="end">
                  {formatCompact(issuanceTick)}
                </text>
                <text className={`axis-text right ${lineMetric}`} x={width - right + 12} y={y + 4}>
                  {lineMetric === "reward" ? overlayTick.toFixed(2) : formatCompact(overlayTick)}
                </text>
              </g>
            );
          })}

          <rect
            className="selected-month-band"
            x={left + step * selectedIndex}
            y={top}
            width={step}
            height={plotHeight}
          />

          {equalityStart !== null && equalityEnd !== null ? (
            <g className="equality-window">
              <rect
                x={equalityStart}
                y={top}
                width={Math.max(4, equalityEnd - equalityStart)}
                height={plotHeight}
              />
              <text x={equalityStart - 7} y={top + 14} textAnchor="end">
                BASE = TAIL
              </text>
            </g>
          ) : null}

          {lineMetric === "unlocked" ? <path className="combined-area" d={overlayArea} /> : null}

          {rows.map((row, index) => {
            const barWidth = step * 0.56;
            const x = left + step * (index + 0.5);
            const mined = Number(row.minedXds);
            const unlock = Number(row.treasuryUnlockEnteringMonthXds);
            const total = mined + unlock;
            const minedY = issuanceY(mined);
            const totalY = issuanceY(total);
            const minedHeight = bottom - minedY;
            const unlockHeight = minedY - totalY;
            const minerLabelY = minedY + Math.min(14, minedHeight / 2);
            return (
              <g className="combined-bar" data-selected={index === selectedIndex} key={row.globalMonth}>
                <rect
                  className="miner-segment"
                  data-mined-xds={row.minedXds}
                  x={x - barWidth / 2}
                  y={minedY}
                  width={barWidth}
                  height={minedHeight}
                  rx={unlock > 0 ? 1 : 3}
                />
                {unlock > 0 ? (
                  <rect
                    className="unlock-segment"
                    data-unlock-xds={row.treasuryUnlockEnteringMonthXds}
                    x={x - barWidth / 2}
                    y={totalY}
                    width={barWidth}
                    height={unlockHeight}
                    rx={3}
                  />
                ) : null}
                <text
                  className="miner-value-label"
                  x={x}
                  y={minerLabelY}
                  dominantBaseline="middle"
                  textAnchor="middle"
                >
                  {formatCompact(mined)}
                </text>
                {unlock > 0 ? (
                  <text
                    className="unlock-value-label"
                    x={x}
                    y={Math.max(top + 14, totalY - 8)}
                    textAnchor="middle"
                  >
                    +{formatCompact(unlock)}
                  </text>
                ) : null}
                <text className="month-text" x={x} y={bottom + 30} textAnchor="middle">M{row.month}</text>
              </g>
            );
          })}

          <path className={`combined-overlay-line ${lineMetric}`} d={overlayPath} />
          <circle
            className={`combined-overlay-point ${lineMetric}`}
            data-selected="true"
            cx={selectedPoint.x}
            cy={selectedPoint.y}
            r={5.5}
          />

          {eventMarkers.map((marker) => (
            <g className={`transition-marker ${marker.kind}`} key={marker.block}>
              <line x1={marker.x} x2={marker.x} y1={top} y2={bottom} />
              <text
                x={
                  marker.labelSide === "left"
                    ? marker.x - 7
                    : Math.min(marker.x + 7, width - right - 112)
                }
                y={marker.labelY}
                textAnchor={marker.labelSide === "left" ? "end" : undefined}
              >
                {marker.label}
              </text>
            </g>
          ))}

          {liveX !== null && liveOverlayY !== null && liveTip ? (
            <g className="live-tip-marker">
              <line x1={liveX} x2={liveX} y1={top} y2={bottom} />
              <circle cx={liveX} cy={liveOverlayY} r={4.5} />
              <text x={liveMarkerLabelX} y={top - 9}>
                TODAY · {liveDateLabel(liveTip).toUpperCase()}
              </text>
            </g>
          ) : null}

          <line
            className="selection-guide"
            x1={left + step * (selectedIndex + 0.5)}
            x2={left + step * (selectedIndex + 0.5)}
            y1={top}
            y2={bottom}
          />
          <g className={`selected-overlay-label ${lineMetric}`}>
            <rect x={selectedOverlayLabelX} y={selectedOverlayLabelY} width={valueLabelWidth} height={valueLabelHeight} rx={5} />
            <text x={selectedOverlayLabelX + valueLabelWidth / 2} y={selectedOverlayLabelY + 16} textAnchor="middle">
              {lineMetric === "reward"
                ? `${Number(rows[selectedIndex].rewardEndXds).toFixed(2)}`
                : formatCompact(overlayValues[selectedIndex + 1])}
            </text>
          </g>
          {rows.map((row, index) => (
            <rect
              className="month-hit-target"
              key={row.globalMonth}
              x={left + step * index}
              y={top}
              width={step}
              height={plotHeight + 38}
              onMouseEnter={() => onSelect(index)}
              onClick={() => onSelect(index)}
            />
          ))}
        </svg>
      </div>

      <div
        className="mobile-chart-overview"
        role="group"
        aria-label="All 12 protocol months in the emission chart"
      >
        <div className="mobile-axis-summary" aria-hidden="true">
          <span>Left · 0–{formatCompact(issuanceMax)}</span>
          <span className={lineMetric}>
            {lineMetric === "reward"
              ? `Reward · ${overlayMin.toFixed(2)}–${overlayMax.toFixed(2)}`
              : `Cumulative · ${formatCompact(overlayMin)}–${formatCompact(overlayMax)}`}
          </span>
        </div>
        <svg
          className="mobile-chart-svg mobile-emission-chart"
          viewBox={`0 0 ${mobileWidth} 236`}
          aria-hidden="true"
          focusable="false"
        >
          {[0, 0.5, 1].map((ratio) => {
            const y = mobileBottom - ratio * mobilePlotHeight;
            return (
              <line
                className="grid-line"
                key={ratio}
                x1={mobileLeft}
                x2={mobileWidth - mobileRight}
                y1={y}
                y2={y}
              />
            );
          })}

          <rect
            className="selected-month-band"
            x={mobileLeft + mobileStep * selectedIndex}
            y={mobileTop}
            width={mobileStep}
            height={mobilePlotHeight}
          />

          {rows.map((row, index) => {
            const barWidth = mobileStep * 0.54;
            const x = mobileLeft + mobileStep * (index + 0.5);
            const mined = Number(row.minedXds);
            const unlock = Number(row.treasuryUnlockEnteringMonthXds);
            const minedY = mobileIssuanceY(mined);
            const totalY = mobileIssuanceY(mined + unlock);
            return (
              <g
                className="combined-bar"
                data-selected={index === selectedIndex}
                key={row.globalMonth}
              >
                <rect
                  className="miner-segment"
                  data-mined-xds={row.minedXds}
                  x={x - barWidth / 2}
                  y={minedY}
                  width={barWidth}
                  height={mobileBottom - minedY}
                  rx={unlock > 0 ? 1 : 2}
                />
                {unlock > 0 ? (
                  <rect
                    className="unlock-segment"
                    data-unlock-xds={row.treasuryUnlockEnteringMonthXds}
                    x={x - barWidth / 2}
                    y={totalY}
                    width={barWidth}
                    height={minedY - totalY}
                    rx={2}
                  />
                ) : null}
                <text className="month-text" x={x} y={mobileBottom + 19} textAnchor="middle">
                  {row.month}
                </text>
              </g>
            );
          })}

          <path
            className={`combined-overlay-line ${lineMetric}`}
            d={mobileOverlayPath}
          />
          <circle
            className={`combined-overlay-point ${lineMetric}`}
            data-selected="true"
            cx={mobileSelectedPoint.x}
            cy={mobileSelectedPoint.y}
            r={4}
          />

          {mobileEventMarkers.map((marker) => (
            <g className={`transition-marker ${marker.kind}`} key={marker.block}>
              <line x1={marker.x} x2={marker.x} y1={mobileTop} y2={mobileBottom} />
            </g>
          ))}

          {liveX !== null && liveTip ? (
            <g className="live-tip-marker">
              <line
                x1={mobileBlockX(liveTip.tipHeight) ?? mobileLeft}
                x2={mobileBlockX(liveTip.tipHeight) ?? mobileLeft}
                y1={mobileTop}
                y2={mobileBottom}
              />
              <text
                x={Math.max(
                  mobileLeft + 2,
                  Math.min(
                    (mobileBlockX(liveTip.tipHeight) ?? mobileLeft) + 4,
                    mobileWidth - mobileRight - 58,
                  ),
                )}
                y={mobileTop - 7}
              >
                TODAY
              </text>
            </g>
          ) : null}

          <line
            className="selection-guide"
            x1={mobileLeft + mobileStep * (selectedIndex + 0.5)}
            x2={mobileLeft + mobileStep * (selectedIndex + 0.5)}
            y1={mobileTop}
            y2={mobileBottom}
          />

          {rows.map((row, index) => (
            <rect
              className="month-hit-target"
              key={row.globalMonth}
              x={mobileLeft + mobileStep * index}
              y={mobileTop}
              width={mobileStep}
              height={mobilePlotHeight + 26}
              onClick={() => onSelect(index)}
            />
          ))}
        </svg>
        {mobileEventMarkers.length > 0 ? (
          <div className="mobile-transition-events" aria-label="Protocol transition events in this year">
            {mobileEventMarkers.map((marker) => (
              <span className={marker.kind} key={marker.block}>
                <strong>{marker.label}</strong>
                <small>Block {formatInteger(marker.block)}</small>
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <p className="mobile-chart-hint">Tap a month or choose one below for the exact readout.</p>

      <MonthNavigator
        id="emission-month-select"
        label="Emission"
        value={selectedIndex}
        period={rows[selectedIndex].period}
        onChange={onSelect}
        liveControl={liveControl}
      />
    </section>
  );
}

export function TreasuryExplorer({
  liveTip,
  liveStatus,
  onRefreshLive,
}: {
  liveTip: LiveChainSnapshot | null;
  liveStatus: LiveChainState["status"];
  onRefreshLive: () => void;
}) {
  const years = emissionData.years.slice(0, 5) as YearData[];
  const treasury = emissionData.meta.treasuryReserve;
  const [manualPosition, setManualPosition] = useState<{
    yearIndex: number;
    monthIndex: number;
  } | null>(null);
  const livePosition =
    liveTip?.withinModel &&
    liveTip.yearIndex !== null &&
    liveTip.yearIndex < years.length &&
    liveTip.monthIndex !== null
      ? { yearIndex: liveTip.yearIndex, monthIndex: liveTip.monthIndex }
      : null;
  const selectedYearIndex = manualPosition?.yearIndex ?? livePosition?.yearIndex ?? 0;
  const selectedMonthIndex = manualPosition?.monthIndex ?? livePosition?.monthIndex ?? 0;
  const year = years[selectedYearIndex];
  const rows = year.months;
  const selected = rows[selectedMonthIndex];
  const total = Number(treasury.totalXds);
  const selectYear = (index: number) => {
    setManualPosition({ yearIndex: index, monthIndex: selectedMonthIndex });
  };
  const selectMonth = (index: number) => {
    setManualPosition({ yearIndex: selectedYearIndex, monthIndex: index });
  };
  const selectToday = () => {
    if (
      liveTip?.withinModel &&
      liveTip.yearIndex !== null &&
      liveTip.yearIndex < years.length &&
      liveTip.monthIndex !== null
    ) {
      setManualPosition(null);
    }
  };
  const treasuryHorizon = [
    { label: "Genesis · fixed", amountXds: treasury.genesisUnlockedXds, yearIndex: null },
    ...years.map((candidate, index) => ({
      label: `Year ${candidate.year}`,
      amountXds: candidate.treasuryUnlockedEndXds,
      yearIndex: index,
    })),
  ];

  const width = 1_020;
  const left = 84;
  const right = 42;
  const top = 44;
  const bottom = 304;
  const plotHeight = bottom - top;
  const plotWidth = width - left - right;
  const step = plotWidth / rows.length;
  const y = (value: number) => bottom - (value / total) * plotHeight;
  const blockX = (blockHeight: number) => {
    if (blockHeight < year.blockStart || blockHeight > year.blockEnd) return null;
    return left + ((blockHeight - year.blockStart + 1) / year.blocks) * plotWidth;
  };
  let stepPath = `M ${left} ${y(Number(rows[0].treasuryUnlockedStartXds))}`;
  for (const [index] of rows.entries()) {
    const boundaryX = left + step * (index + 1);
    stepPath += ` H ${boundaryX}`;
    const nextRow = rows[index + 1];
    if (nextRow) {
      stepPath += ` V ${y(Number(nextRow.treasuryUnlockedStartXds))}`;
    }
  }

  const mobileWidth = 360;
  const mobileLeft = 30;
  const mobileRight = 18;
  const mobileTop = 20;
  const mobileBottom = 202;
  const mobilePlotHeight = mobileBottom - mobileTop;
  const mobilePlotWidth = mobileWidth - mobileLeft - mobileRight;
  const mobileStep = mobilePlotWidth / rows.length;
  const mobileY = (value: number) =>
    mobileBottom - (value / total) * mobilePlotHeight;
  const mobileBlockX = (blockHeight: number) => {
    if (blockHeight < year.blockStart || blockHeight > year.blockEnd) return null;
    return (
      mobileLeft +
      ((blockHeight - year.blockStart + 1) / year.blocks) * mobilePlotWidth
    );
  };
  let mobileStepPath = `M ${mobileLeft} ${mobileY(Number(rows[0].treasuryUnlockedStartXds))}`;
  for (const [index] of rows.entries()) {
    const mobileBoundaryX = mobileLeft + mobileStep * (index + 1);
    mobileStepPath += ` H ${mobileBoundaryX}`;
    const nextRow = rows[index + 1];
    if (nextRow) {
      mobileStepPath += ` V ${mobileY(Number(nextRow.treasuryUnlockedStartXds))}`;
    }
  }

  const selectedPoint = {
    x: left + step * (selectedMonthIndex + 0.5),
    y: y(Number(selected.treasuryUnlockedStartXds)),
  };
  const mobileSelectedPoint = {
    x: mobileLeft + mobileStep * (selectedMonthIndex + 0.5),
    y: mobileY(Number(selected.treasuryUnlockedStartXds)),
  };
  const liveX = liveTip ? blockX(liveTip.tipHeight) : null;
  const mobileLiveX = liveTip ? mobileBlockX(liveTip.tipHeight) : null;
  const liveTreasuryY = liveTip ? y(Number(liveTip.treasuryUnlockedXds)) : null;
  const mobileLiveTreasuryY = liveTip
    ? mobileY(Number(liveTip.treasuryUnlockedXds))
    : null;
  const liveControl: LiveControl = liveTip
    ? liveTip.withinModel && liveTip.yearIndex !== null && liveTip.yearIndex < years.length
      ? {
          active:
            liveTip.yearIndex === selectedYearIndex &&
            liveTip.monthIndex === selectedMonthIndex,
          detail: `${liveDateLabel(liveTip)} · H ${formatInteger(liveTip.tipHeight)}`,
          disabled: false,
          label: "Today",
          onClick: selectToday,
        }
      : {
          active: false,
          detail: "Outside Treasury horizon",
          disabled: true,
          label: "Today",
          onClick: selectToday,
        }
    : {
        active: false,
        detail: liveStatus === "error" ? "RPC unavailable" : "Connecting to RPC",
        disabled: liveStatus !== "error",
        label: liveStatus === "error" ? "Retry live" : "Today",
        onClick: onRefreshLive,
      };

  return (
    <section className="section treasury-section" id="treasury" aria-labelledby="treasury-title">
      <div className="container">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Genesis allocation · unlock schedule</p>
            <h2 id="treasury-title">The 1.05M XDS reserve unlocks in 21 fixed batches.</h2>
          </div>
          <div className="section-intro">
            <p>
              Consensus creates 1,050,000 XDS at genesis as 21 outputs of 50,000 XDS.
              Batch 1 is spendable from genesis; one more batch unlocks every 87,600 blocks.
            </p>
            <p>
              Commonly called a premine, the code names it the <strong>Treasury Reserve</strong>.
              The schedule is provable; off-chain ownership and later spending are not.
            </p>
          </div>
        </div>

        <div className="treasury-facts" aria-label="Treasury Reserve facts">
          <div><span>Total genesis allocation</span><strong>1,050,000 XDS</strong></div>
          <div><span>Spendable from genesis</span><strong>50,000 XDS</strong></div>
          <div><span>Each later unlock</span><strong>50,000 / 87,600 blocks</strong></div>
          <div><span>Fully scheduled unlocked</span><strong>Block 1,752,000 · Year 5</strong></div>
        </div>

        <div className="treasury-explorer-shell">
          <div className="treasury-chart-head">
            <div>
              <span>Independent Treasury view</span>
              <h3>Treasury unlock schedule · Protocol Year {year.year}</h3>
              <p>
                Every column totals 1.05M XDS: available from that month’s first block below,
                still time-locked at month start above. An amber +50K cap marks a batch that
                unlocked on the boundary immediately before that month.
              </p>
            </div>
          </div>

          <div className="active-legend treasury-legend" aria-label="Treasury chart series">
            <span><i className="legend-swatch treasury-unlocked" /> Treasury available from month start</span>
            <span><i className="legend-swatch treasury-locked" /> Still time-locked at month start</span>
            <span><i className="legend-swatch treasury-step" /> Cumulative month-start availability</span>
            <span className="scale-note">Fixed scale · 0–1.05M XDS</span>
          </div>

          <div className="treasury-horizon" aria-label="Five-year Treasury Reserve unlock overview">
            <div className="treasury-horizon-head">
              <span>Choose the Treasury protocol year</span>
              <strong>The selected month stays in place · values are scheduled year-end totals</strong>
            </div>
            <div className="treasury-horizon-grid" role="group" aria-label="Select Treasury protocol year">
              {treasuryHorizon.map((milestone) => {
                const content = (
                  <>
                    <span className="treasury-horizon-value">
                      <span>{milestone.label}</span>
                      <strong>{formatCompact(milestone.amountXds)}</strong>
                    </span>
                    <span className="treasury-horizon-track" aria-hidden="true">
                      <span style={{ width: `${(Number(milestone.amountXds) / total) * 100}%` }} />
                    </span>
                  </>
                );

                if (milestone.yearIndex === null) {
                  return <div className="treasury-horizon-item" key={milestone.label}>{content}</div>;
                }

                return (
                  <button
                    className="treasury-horizon-item"
                    key={milestone.label}
                    type="button"
                    data-selected={milestone.yearIndex === selectedYearIndex}
                    aria-pressed={milestone.yearIndex === selectedYearIndex}
                    aria-label={`Protocol Year ${milestone.yearIndex + 1}, ${formatCompact(milestone.amountXds)} Treasury scheduled unlocked by year end`}
                    onClick={() => selectYear(milestone.yearIndex)}
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="chart-viewport desktop-chart-viewport treasury-chart-viewport" tabIndex={0} aria-label={`Treasury Reserve unlock chart for Protocol Year ${year.year}`}>
            <svg className="treasury-chart-svg" viewBox={`0 0 ${width} 360`} aria-hidden="true" focusable="false">
              <text className="axis-title" x={left} y={20}>TREASURY SCHEDULED STATUS · XDS</text>
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const tick = total * ratio;
                const tickY = bottom - ratio * plotHeight;
                return (
                  <g key={ratio}>
                    <line className="grid-line" x1={left} x2={width - right} y1={tickY} y2={tickY} />
                    <text className="axis-text" x={left - 12} y={tickY + 4} textAnchor="end">{formatCompact(tick)}</text>
                  </g>
                );
              })}

              <rect
                className="selected-month-band"
                x={left + step * selectedMonthIndex}
                y={top}
                width={step}
                height={plotHeight}
              />

              {rows.map((row, index) => {
                const unlocked = Number(row.treasuryUnlockedStartXds);
                const locked = total - unlocked;
                const unlockEnteringMonth = Number(row.treasuryUnlockEnteringMonthXds);
                const barWidth = step * 0.58;
                const centerX = left + step * (index + 0.5);
                const x = centerX - barWidth / 2;
                const unlockedHeight = (unlocked / total) * plotHeight;
                const lockedHeight = (locked / total) * plotHeight;
                const boundaryY = y(unlocked);
                return (
                  <g className="treasury-month-bar" data-selected={index === selectedMonthIndex} key={row.globalMonth}>
                    <rect className="locked" x={x} y={top} width={barWidth} height={lockedHeight} rx={3} />
                    <rect className="unlocked" x={x} y={top + lockedHeight} width={barWidth} height={unlockedHeight} rx={3} />
                    {unlockEnteringMonth > 0 ? (
                      <>
                        <line className="treasury-unlock-cap" x1={x} x2={x + barWidth} y1={boundaryY} y2={boundaryY} />
                        <text className="unlock-label" x={centerX} y={Math.max(top + 14, boundaryY - 8)} textAnchor="middle">
                          +{formatCompact(unlockEnteringMonth)}
                        </text>
                      </>
                    ) : null}
                    <text className="month-text" x={centerX} y={bottom + 29} textAnchor="middle">M{row.month}</text>
                  </g>
                );
              })}

              <path className="treasury-step-line" d={stepPath} />
              {liveX !== null && liveTreasuryY !== null && liveTip ? (
                <g className="live-tip-marker">
                  <line x1={liveX} x2={liveX} y1={top} y2={bottom} />
                  <circle cx={liveX} cy={liveTreasuryY} r={4.5} />
                  <text
                    x={Math.max(left + 4, Math.min(liveX + 7, width - right - 112))}
                    y={top - 8}
                  >
                    TODAY · {liveDateLabel(liveTip).toUpperCase()}
                  </text>
                </g>
              ) : null}
              <circle className="treasury-step-point unlocked" cx={selectedPoint.x} cy={selectedPoint.y} r={4.5} />
              <line
                className="selection-guide"
                x1={selectedPoint.x}
                x2={selectedPoint.x}
                y1={top}
                y2={bottom}
              />
              {rows.map((row, index) => (
                <rect
                  className="month-hit-target"
                  key={row.globalMonth}
                  x={left + step * index}
                  y={top}
                  width={step}
                  height={plotHeight + 38}
                  onMouseEnter={() => selectMonth(index)}
                  onClick={() => selectMonth(index)}
                />
              ))}
            </svg>
          </div>

          <div className="mobile-chart-overview treasury-mobile-overview" role="group" aria-label={`All 12 protocol months in the Protocol Year ${year.year} Treasury chart`}>
            <div className="mobile-axis-summary" aria-hidden="true">
              <span>Treasury schedule · 0–1.05M XDS</span>
              <span className="reward">Unlocked / still time-locked</span>
            </div>
            <svg className="mobile-chart-svg mobile-treasury-chart" viewBox={`0 0 ${mobileWidth} 232`} aria-hidden="true" focusable="false">
              {[0, 0.5, 1].map((ratio) => {
                const tickY = mobileBottom - ratio * mobilePlotHeight;
                return (
                  <line className="grid-line" key={ratio} x1={mobileLeft} x2={mobileWidth - mobileRight} y1={tickY} y2={tickY} />
                );
              })}

              <rect
                className="selected-month-band"
                x={mobileLeft + mobileStep * selectedMonthIndex}
                y={mobileTop}
                width={mobileStep}
                height={mobilePlotHeight}
              />

              {rows.map((row, index) => {
                const unlocked = Number(row.treasuryUnlockedStartXds);
                const locked = total - unlocked;
                const barWidth = mobileStep * 0.54;
                const centerX = mobileLeft + mobileStep * (index + 0.5);
                const x = centerX - barWidth / 2;
                const unlockedHeight = (unlocked / total) * mobilePlotHeight;
                const lockedHeight = (locked / total) * mobilePlotHeight;
                return (
                  <g className="treasury-month-bar" data-selected={index === selectedMonthIndex} key={row.globalMonth}>
                    <rect className="locked" x={x} y={mobileTop} width={barWidth} height={lockedHeight} rx={2} />
                    <rect className="unlocked" x={x} y={mobileTop + lockedHeight} width={barWidth} height={unlockedHeight} rx={2} />
                    <text className="month-text" x={centerX} y={mobileBottom + 19} textAnchor="middle">{row.month}</text>
                  </g>
                );
              })}

              <path className="treasury-step-line" d={mobileStepPath} />
              {mobileLiveX !== null && mobileLiveTreasuryY !== null ? (
                <g className="live-tip-marker">
                  <line x1={mobileLiveX} x2={mobileLiveX} y1={mobileTop} y2={mobileBottom} />
                  <circle cx={mobileLiveX} cy={mobileLiveTreasuryY} r={3.5} />
                  <text
                    x={Math.max(
                      mobileLeft + 2,
                      Math.min(mobileLiveX + 4, mobileWidth - mobileRight - 58),
                    )}
                    y={mobileTop - 6}
                  >
                    TODAY
                  </text>
                </g>
              ) : null}
              <circle className="treasury-step-point unlocked" cx={mobileSelectedPoint.x} cy={mobileSelectedPoint.y} r={3.5} />
              <line
                className="selection-guide"
                x1={mobileSelectedPoint.x}
                x2={mobileSelectedPoint.x}
                y1={mobileTop}
                y2={mobileBottom}
              />

              {rows.map((row, index) => (
                <rect
                  className="month-hit-target"
                  key={row.globalMonth}
                  x={mobileLeft + mobileStep * index}
                  y={mobileTop}
                  width={mobileStep}
                  height={mobilePlotHeight + 26}
                  onClick={() => selectMonth(index)}
                />
              ))}
            </svg>
          </div>
          <p className="mobile-chart-hint">Tap a month or choose one below for the exact Treasury readout.</p>

          <MonthNavigator
            id="treasury-month-select"
            label="Treasury"
            value={selectedMonthIndex}
            period={selected.period}
            onChange={selectMonth}
            liveControl={liveControl}
          />

          <div className="treasury-readout" role="status" aria-live="polite" aria-atomic="true">
            <div><span>Year {selected.year} · Month {selected.month}</span><strong>{selected.period}</strong></div>
            <div><span>Exact blocks</span><strong>{formatInteger(selected.blockStart)}–{formatInteger(selected.blockEnd)}</strong></div>
            <div><span>Treasury available from month start</span><strong>{formatNumber(selected.treasuryUnlockedStartXds)} XDS</strong></div>
            <div><span>Still time-locked at month start</span><strong>{formatNumber(total - Number(selected.treasuryUnlockedStartXds))} XDS</strong></div>
            <div><span>Unlock entering selected month</span><strong>{formatNumber(selected.treasuryUnlockEnteringMonthXds)} XDS</strong></div>
            <div><span>Batches available from month start</span><strong>{Number(selected.treasuryUnlockedStartXds) / Number(treasury.batchXds)} / {treasury.batches}</strong></div>
          </div>

          <aside className="ownership-caveat">
            <strong>Do not read this as a live holder balance.</strong>
            <span>
              “Scheduled unlocked” means the genesis outputs are permitted to become spendable by consensus.
              It does not prove who currently controls the recipient keys, whether unlocked outputs were spent,
              or how many coins any developer holds today.
            </span>
          </aside>

          <details className="exact-table treasury-table">
            <summary>View all 21 exact unlock batches</summary>
            <div className="table-wrap treasury-table-wrap">
              <table className="data-table treasury-data-table">
                <caption className="sr-only">Exact genesis Treasury Reserve unlock schedule</caption>
                <thead>
                  <tr>
                    <th>Batch</th>
                    <th>Amount</th>
                    <th>Spendable at block</th>
                    <th>Consensus unlock month</th>
                    <th>Projected date</th>
                    <th>Cumulative unlocked</th>
                    <th>Remaining locked</th>
                  </tr>
                </thead>
                <tbody>
                  {treasury.schedule.map((batch) => (
                    <tr key={batch.batch}>
                      <td data-label="Batch">{batch.batch}</td>
                      <td data-label="Amount · XDS">{formatNumber(batch.amountXds)}</td>
                      <td data-label="Spendable at block">{batch.unlockBlock === 0 ? "0 · genesis" : formatInteger(batch.unlockBlock)}</td>
                      <td data-label="Consensus unlock month">{batch.unlockBlock === 0 ? "Genesis" : `Y${batch.protocolYear} · M${batch.protocolMonth} · final block`}</td>
                      <td data-label="Projected date">{batch.projectedDate}</td>
                      <td data-label="Cumulative unlocked · XDS">{formatNumber(batch.cumulativeUnlockedXds)}</td>
                      <td data-label="Remaining locked · XDS">{formatNumber(batch.remainingLockedXds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
