<script lang="ts" module>
  export interface Segment {
    label: string;
    value: number; // cents, >= 0
    color: string;
  }
</script>

<script lang="ts">
  let {
    segments,
    centerLabel,
    centerValue,
    centerTone = ''
  }: {
    segments: Segment[];
    centerLabel: string;
    centerValue: string;
    centerTone?: '' | 'neg';
  } = $props();

  const RADIUS = 52;
  const C = 2 * Math.PI * RADIUS;

  let total = $derived(segments.reduce((s, x) => s + Math.max(x.value, 0), 0));

  // Each arc is a dash on one circle, starting where the previous one ended.
  let arcs = $derived.by(() => {
    let offset = 0;
    return segments
      .filter((s) => s.value > 0)
      .map((s) => {
        const len = total > 0 ? (s.value / total) * C : 0;
        const arc = { ...s, dash: `${len} ${C - len}`, offset: -offset };
        offset += len;
        return arc;
      });
  });
</script>

<div class="donut-wrap">
  <svg viewBox="0 0 140 140" class="donut" role="img" aria-label="{centerLabel} {centerValue}">
    <circle cx="70" cy="70" r={RADIUS} class="track" />
    {#each arcs as arc (arc.label)}
      <circle
        cx="70"
        cy="70"
        r={RADIUS}
        fill="none"
        stroke={arc.color}
        stroke-width="16"
        stroke-dasharray={arc.dash}
        stroke-dashoffset={arc.offset}
        transform="rotate(-90 70 70)"
      />
    {/each}
  </svg>
  <div class="center">
    <span class="center-label">{centerLabel}</span>
    <strong class="center-value {centerTone}">{centerValue}</strong>
  </div>
</div>

<style>
  .donut-wrap {
    position: relative;
    width: 180px;
    height: 180px;
    margin: 0 auto;
  }
  .donut {
    width: 100%;
    height: 100%;
  }
  .track {
    fill: none;
    stroke: var(--color-border);
    stroke-width: 16;
  }
  .center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 2px;
  }
  .center-label {
    font-size: 0.65rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
  }
  .center-value {
    font-size: 0.95rem;
  }
  .center-value.neg {
    color: var(--color-negative);
  }
</style>
