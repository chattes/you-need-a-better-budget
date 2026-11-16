<script lang="ts">
  import { onMount } from 'svelte';
  import { Chart, registerables } from 'chart.js';
  import 'chartjs-adapter-date-fns';

  Chart.register(...registerables);

  let { points }: { points: Array<{ date: string; net_worth: number }> } = $props();

  let canvas: HTMLCanvasElement | undefined = $state();
  let chart: Chart | null = null;

  onMount(() => {
    if (!canvas) return;
    chart = new Chart(canvas, {
      type: 'line',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { x: { type: 'time', time: { unit: 'day' } } },
        plugins: { legend: { display: false } }
      }
    });
    return () => chart?.destroy();
  });

  $effect(() => {
    if (!chart) return;
    chart.data.labels = points.map((p) => p.date);
    chart.data.datasets = [
      {
        label: 'Net worth',
        data: points.map((p) => p.net_worth / 100),
        borderColor: '#6a1b9a',
        backgroundColor: 'rgb(106 27 154 / 0.1)',
        fill: true,
        tension: 0.3
      }
    ];
    chart.update();
  });
</script>

<div class="chart-wrap">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .chart-wrap {
    height: 280px;
  }
</style>
