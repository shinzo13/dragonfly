export interface Learned {
  id: string;
  name: string;
}

function learnedMap(key: string) {
  const read = (): Record<string, Learned> => {
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? "{}");
      return value && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  };

  const get = (place: string): Learned | null => read()[place] ?? null;

  const set = (place: string, learned: Learned | null) => {
    const map = read();
    if (learned) {
      map[place] = { id: learned.id, name: learned.name };
    } else {
      delete map[place];
    }
    localStorage.setItem(key, JSON.stringify(map));
  };

  const remember = (place: string, learned: Learned) => {
    const before = get(place);
    set(place, learned);
    return () => set(place, before);
  };

  return { get, remember };
}

export const learnedBudgets = learnedMap("ffui.budget-map");

export const learnedCategories = learnedMap("ffui.category-map");
