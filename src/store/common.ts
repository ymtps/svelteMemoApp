import { writable } from "svelte/store";

export const showDeleteMemoModalFlg = writable<boolean>(false);
export const selectIndex = writable<number>(null);

export type memo = {
  title: string;
  context: string;
  date: string;
};

export const memoList = writable<memo[]>([]);
