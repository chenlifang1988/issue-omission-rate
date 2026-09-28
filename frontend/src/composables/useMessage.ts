import { ref } from 'vue';

export interface Toast {
  text: string;
  type: 'success' | 'error';
}

export const toast = ref<Toast | null>(null);
let timer: number | undefined;

export function notify(text: string, type: 'success' | 'error' = 'success') {
  toast.value = { text, type };
  if (timer) {
    window.clearTimeout(timer);
  }
  timer = window.setTimeout(() => {
    toast.value = null;
  }, 3000);
}
