<script lang="ts">
  import { onMount } from 'svelte';
  import { Chart, registerables } from 'chart.js';
  import 'chartjs-adapter-date-fns';

  Chart.register(...registerables);

  let {
    labels,
    income,
    expense
  }: { labels: string[]; income: number[]; expense: number[] } = $props();

  let canvas: HTMLCanvasElement | undefined = $state();
  let chart: Chart | null = null;

  onMount(() => {
    if (!canvas) return;
    chart = new Chart(canvas, {
      type: 'bar',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } }
      }
    });
    return () => chart?.destroy();
  });

  $effect(() => {
    if (!chart) return;
    chart.data.labels = labels;
    chart.data.datasets = [
      {
        label: 'Income',
        data: income.map((v) => v / 100),
        backgroundColor: '#2e7d32'
      },
      {
        label: 'Spending',
        data: expense.map((v) => v / 100),
        backgroundColor: '#c62828'
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
