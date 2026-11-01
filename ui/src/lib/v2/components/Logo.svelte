<script lang="ts">
  let { size = 20 }: { size?: number } = $props();
</script>

<svg aria-hidden="true" fill="currentColor" height={size} viewBox="0 3.5 64 64" width={size}>
  <path d="M30 24Q16 13.5 4.5 17.5Q2 21 6 22.5Q18 25.5 30 25Z"/>
  <path d="M34 24Q48 13.5 59.5 17.5Q62 21 58 22.5Q46 25.5 34 25Z"/>
  <path d="M30 27.5Q18 25.5 8 31Q5.5 34 9 35Q20 33.5 30 28.5Z" opacity=".55"/>
  <path d="M34 27.5Q46 25.5 56 31Q58.5 34 55 35Q44 33.5 34 28.5Z" opacity=".55"/>
  <circle cx="32" cy="17.5" r="3.4"/>
  <ellipse cx="32" cy="25.5" rx="2.9" ry="5"/>
  <path d="M30.5 29H33.5L32.8 57.5Q32 59.5 31.2 57.5Z"/>
</svg>
