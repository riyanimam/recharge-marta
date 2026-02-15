<script setup lang="ts">
/**
 * Skeleton loader component — animated placeholder for loading states.
 * Inspired by the georgia-legislation-webcrawler StatsSkeleton / BillGridSkeleton.
 */
defineProps<{
  /** "stat" emulates a stats card row; "card" emulates a content card; "row" emulates a list row. */
  variant?: "stat" | "card" | "row";
  /** How many skeleton items to render. */
  count?: number;
}>();
</script>

<template>
  <div class="skeleton-container" :class="`skeleton--${variant ?? 'card'}`">
    <div v-for="i in (count ?? 3)" :key="i" class="skeleton-item" role="status" :aria-label="'Loading content'">
      <!-- stat variant: mimic the 3 overview stat boxes -->
      <template v-if="variant === 'stat'">
        <div class="skel-line skel-line--short" />
        <div class="skel-line skel-line--number" />
      </template>

      <!-- row variant: mimic a list row -->
      <template v-else-if="variant === 'row'">
        <div class="skel-line skel-line--long" />
        <div class="skel-line skel-line--medium" />
      </template>

      <!-- card variant (default): mimic a section card -->
      <template v-else>
        <div class="skel-line skel-line--heading" />
        <div class="skel-line skel-line--long" />
        <div class="skel-line skel-line--medium" />
        <div class="skel-line skel-line--short" />
      </template>
    </div>
  </div>
</template>

<style scoped>
.skeleton-container {
  display: grid;
  gap: var(--rm-space-md);
}

.skeleton--stat {
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
}

.skeleton--card {
  grid-template-columns: 1fr;
}

.skeleton--row {
  grid-template-columns: 1fr;
}

.skeleton-item {
  display: flex;
  flex-direction: column;
  gap: var(--rm-space-sm);
  padding: var(--rm-space-lg);
  border-radius: var(--rm-radius-md);
  border: 1px solid var(--rm-border-subtle);
  background: var(--rm-bg-inset);
}

.skel-line {
  border-radius: 4px;
  background: var(--rm-border-default);
  animation: shimmer 1.5s ease-in-out infinite alternate;
}

.skel-line--heading {
  width: 50%;
  height: 1.2rem;
}

.skel-line--long {
  width: 95%;
  height: 0.85rem;
}

.skel-line--medium {
  width: 65%;
  height: 0.85rem;
}

.skel-line--short {
  width: 35%;
  height: 0.85rem;
}

.skel-line--number {
  width: 40%;
  height: 1.6rem;
}

@keyframes shimmer {
  from {
    opacity: 0.45;
  }
  to {
    opacity: 1;
  }
}
</style>
