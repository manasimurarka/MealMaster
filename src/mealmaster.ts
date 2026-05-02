import { sampleRecipes } from "./sampleData";
import { readStorage, removeStorage, writeStorage } from "./storage";
import type {
  AppBootstrapData,
  GroceryListData,
  GroceryListItem,
  IngredientCategory,
  IngredientCategoryMemory,
  PlannerConstraints,
  PreferenceMode,
  Recipe,
  RecipeIngredient,
  RecommendationResult,
  UnscheduledMeal,
  WeekDay,
  WeekPlan,
  WeekPlanStore,
  WeekSummary
} from "./types";

export const STORAGE_KEYS = {
  recipes: "mealmaster.recipes",
  weekPlans: "mealmaster.weekPlans",
  ingredientCategoryMemory: "mealmaster.ingredientCategoryMemory",
  legacyWeeklyPlan: "mealmaster.weeklyPlan",
  seedVersion: "mealmaster.seedVersion"
} as const;

export const DEMO_SEED_VERSION = "mealmaster-2026-05-v2";

export const ingredientCategories: IngredientCategory[] = [
  "Produce",
  "Dairy",
  "Protein",
  "Pantry",
  "Spices/Condiments",
  "Frozen",
  "Other"
];

export const preferenceModes: PreferenceMode[] = [
  "shared ingredients",
  "fastest recipes",
  "balanced",
  "variety-focused"
];

export const defaultConstraints: PlannerConstraints = {
  targetPortions: 8,
  preferredUniqueRecipes: 3,
  maxTotalMinutes: 120,
  tagFilters: [],
  useSoonIngredients: [],
  mode: "balanced"
};

function padNumber(value: number) {
  return String(value).padStart(2, "0");
}

export function toLocalIsoDate(date: Date) {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
}

export function parseLocalIsoDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function getWeekStart(date: Date) {
  const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = localDate.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  localDate.setDate(localDate.getDate() + delta);
  return toLocalIsoDate(localDate);
}

export function shiftWeekStart(weekStart: string, deltaWeeks: number) {
  const nextWeek = parseLocalIsoDate(weekStart);
  nextWeek.setDate(nextWeek.getDate() + deltaWeeks * 7);
  return toLocalIsoDate(nextWeek);
}

export function formatWeekRangeLabel(weekStart: string) {
  const start = parseLocalIsoDate(weekStart);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  end.setDate(end.getDate() + 6);

  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  });

  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

export function getWeekDays(weekStart: string): WeekDay[] {
  const start = parseLocalIsoDate(weekStart);
  const weekDays: WeekDay[] = [];
  const dayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "long" });
  const shortFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short" });
  const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });

  for (let index = 0; index < 7; index += 1) {
    const currentDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    currentDate.setDate(currentDate.getDate() + index);
    weekDays.push({
      date: toLocalIsoDate(currentDate),
      dayName: dayFormatter.format(currentDate),
      shortDay: shortFormatter.format(currentDate),
      monthLabel: monthFormatter.format(currentDate),
      dayNumber: currentDate.getDate()
    });
  }

  return weekDays;
}

export function createEmptyWeekPlan(weekStart: string): WeekPlan {
  return {
    weekStart,
    useSoonIngredients: [],
    checkedGroceries: [],
    dayAssignments: [],
    unscheduledMeals: []
  };
}

export function createEmptyWeekPlanStore(referenceDate = new Date()): WeekPlanStore {
  const selectedWeekStart = getWeekStart(referenceDate);
  return {
    selectedWeekStart,
    weeksByStart: {
      [selectedWeekStart]: createEmptyWeekPlan(selectedWeekStart)
    }
  };
}

export function getWeekPlan(store: WeekPlanStore, weekStart: string) {
  return store.weeksByStart[weekStart] ?? createEmptyWeekPlan(weekStart);
}

export function normalizeWeekPlanStore(store: WeekPlanStore, recipes: Recipe[]) {
  const selectedWeekStart = store.selectedWeekStart || getWeekStart(new Date());
  const validRecipeIds = new Set(recipes.map((recipe) => recipe.id));
  const normalizedWeeks = Object.fromEntries(
    Object.entries(store.weeksByStart ?? {}).map(([weekStart, plan]) => [
      weekStart,
      {
        ...createEmptyWeekPlan(weekStart),
        ...plan,
        weekStart,
        useSoonIngredients: (plan.useSoonIngredients ?? []).filter(Boolean),
        checkedGroceries: (plan.checkedGroceries ?? []).filter(Boolean),
        dayAssignments: (plan.dayAssignments ?? []).filter(
          (assignment) =>
            Boolean(assignment?.id) &&
            validRecipeIds.has(assignment.recipeId) &&
            Boolean(assignment.date) &&
            assignment.plannedPortions > 0
        ),
        unscheduledMeals: (plan.unscheduledMeals ?? []).filter(
          (meal) =>
            Boolean(meal?.id) && validRecipeIds.has(meal.recipeId) && meal.plannedPortions > 0
        )
      }
    ])
  );

  if (!normalizedWeeks[selectedWeekStart]) {
    normalizedWeeks[selectedWeekStart] = createEmptyWeekPlan(selectedWeekStart);
  }

  return {
    selectedWeekStart,
    weeksByStart: normalizedWeeks
  };
}

export function createEmptyIngredient(): RecipeIngredient {
  return {
    id: crypto.randomUUID(),
    name: "",
    amountText: "",
    category: "Other"
  };
}

export function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildIngredientCategoryMemory(recipes: Recipe[]): IngredientCategoryMemory {
  const memory: IngredientCategoryMemory = {};

  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients) {
      const normalizedName = normalizeText(ingredient.name);

      if (!normalizedName) {
        continue;
      }

      memory[normalizedName] = ingredient.category;
    }
  }

  return memory;
}

export function bootstrapAppData(): AppBootstrapData {
  const fallbackStore = createEmptyWeekPlanStore();
  const fallbackMemory = buildIngredientCategoryMemory(sampleRecipes);

  if (typeof window === "undefined") {
    return {
      recipes: sampleRecipes,
      ingredientCategoryMemory: fallbackMemory,
      weekPlanStore: fallbackStore
    };
  }

  const seedVersion = window.localStorage.getItem(STORAGE_KEYS.seedVersion);

  if (seedVersion !== DEMO_SEED_VERSION) {
    writeStorage(STORAGE_KEYS.recipes, sampleRecipes);
    writeStorage(STORAGE_KEYS.ingredientCategoryMemory, fallbackMemory);
    writeStorage(STORAGE_KEYS.weekPlans, fallbackStore);
    removeStorage(STORAGE_KEYS.legacyWeeklyPlan);
    window.localStorage.setItem(STORAGE_KEYS.seedVersion, DEMO_SEED_VERSION);

    return {
      recipes: sampleRecipes,
      ingredientCategoryMemory: fallbackMemory,
      weekPlanStore: fallbackStore
    };
  }

  const recipes = readStorage(STORAGE_KEYS.recipes, sampleRecipes);
  const ingredientCategoryMemory = readStorage(
    STORAGE_KEYS.ingredientCategoryMemory,
    buildIngredientCategoryMemory(recipes)
  );
  const weekPlanStore = normalizeWeekPlanStore(
    readStorage(STORAGE_KEYS.weekPlans, fallbackStore),
    recipes
  );

  return {
    recipes,
    ingredientCategoryMemory,
    weekPlanStore
  };
}

export function getUniqueTags(recipes: Recipe[]) {
  return Array.from(new Set(recipes.flatMap((recipe) => recipe.tags))).toSorted((left, right) =>
    left.localeCompare(right)
  );
}

export function getUniqueIngredientNames(recipes: Recipe[]) {
  return Array.from(
    new Set(
      recipes
        .flatMap((recipe) => recipe.ingredients.map((ingredient) => ingredient.name.trim()))
        .filter(Boolean)
    )
  ).toSorted((left, right) => left.localeCompare(right));
}

export function matchesRecipeSearch(recipe: Recipe, query: string) {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return true;
  }

  return [recipe.name, recipe.tags.join(" "), recipe.ingredients.map((ingredient) => ingredient.name).join(" ")]
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

export function calculateEstimatedBatches(recipe: Recipe, plannedPortions: number) {
  return Math.max(1, Math.ceil(plannedPortions / Math.max(recipe.portions, 1)));
}

function buildSuggestionExplanation(
  recipe: Recipe,
  selectedRecipes: Recipe[],
  constraints: PlannerConstraints
) {
  const explanations: string[] = [];
  const useSoonSet = new Set(constraints.useSoonIngredients.map(normalizeText));
  const ingredientNames = recipe.ingredients.map((ingredient) => normalizeText(ingredient.name));
  const useSoonMatches = ingredientNames.filter((name) => useSoonSet.has(name));

  if (useSoonMatches.length > 0) {
    explanations.push(`Uses ${useSoonMatches.slice(0, 2).join(" and ")}`);
  }

  if (constraints.mode === "fastest recipes") {
    explanations.push(`Fits your time limit at ${recipe.totalTimeMinutes} min`);
  }

  if (constraints.mode === "shared ingredients") {
    const selectedIngredientSet = new Set(
      selectedRecipes.flatMap((selectedRecipe) =>
        selectedRecipe.ingredients.map((ingredient) => normalizeText(ingredient.name))
      )
    );
    const sharedCount = ingredientNames.filter((name) => selectedIngredientSet.has(name)).length;

    if (sharedCount > 0) {
      explanations.push(`Reuses ${sharedCount} shared ingredient${sharedCount > 1 ? "s" : ""}`);
    }
  }

  if (constraints.mode === "variety-focused") {
    const selectedTagSet = new Set(selectedRecipes.flatMap((selectedRecipe) => selectedRecipe.tags));
    const freshTags = recipe.tags.filter((tag) => !selectedTagSet.has(tag));

    if (freshTags.length > 0) {
      explanations.push(`Adds variety with ${freshTags.slice(0, 2).join(" / ")}`);
    }
  }

  if (constraints.mode === "balanced" || explanations.length === 0) {
    explanations.push(`${recipe.portions} portions in ${recipe.totalTimeMinutes} min`);
  }

  return explanations.slice(0, 3);
}

function scoreRecipe(recipe: Recipe, selectedRecipes: Recipe[], constraints: PlannerConstraints) {
  const usedSoonSet = new Set(constraints.useSoonIngredients.map(normalizeText));
  const selectedIngredientSet = new Set(
    selectedRecipes.flatMap((selectedRecipe) =>
      selectedRecipe.ingredients.map((ingredient) => normalizeText(ingredient.name))
    )
  );
  const selectedTagSet = new Set(selectedRecipes.flatMap((selectedRecipe) => selectedRecipe.tags));

  const ingredientNames = recipe.ingredients.map((ingredient) => normalizeText(ingredient.name));
  const sharedIngredientCount = ingredientNames.filter((name) => selectedIngredientSet.has(name)).length;
  const useSoonCount = ingredientNames.filter((name) => usedSoonSet.has(name)).length;
  const unseenTagCount = recipe.tags.filter((tag) => !selectedTagSet.has(tag)).length;
  const portionsPerMinute = recipe.portions / Math.max(recipe.totalTimeMinutes, 1);

  const sharedScore = sharedIngredientCount * 16 + useSoonCount * 26 + portionsPerMinute * 18;
  const fastestScore = 120 - recipe.totalTimeMinutes + portionsPerMinute * 46 + useSoonCount * 7;
  const balancedScore =
    portionsPerMinute * 42 + sharedIngredientCount * 12 + useSoonCount * 16 + unseenTagCount * 4;
  const varietyScore =
    unseenTagCount * 18 + portionsPerMinute * 14 + useSoonCount * 10 - sharedIngredientCount * 3;

  switch (constraints.mode) {
    case "shared ingredients":
      return sharedScore;
    case "fastest recipes":
      return fastestScore;
    case "variety-focused":
      return varietyScore;
    case "balanced":
    default:
      return balancedScore;
  }
}

function buildRecommendationOverview(
  recipes: Recipe[],
  suggestions: UnscheduledMeal[],
  constraints: PlannerConstraints
) {
  const overview: string[] = [];
  const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const selectedRecipes = suggestions
    .map((suggestion) => recipesById.get(suggestion.recipeId))
    .filter((recipe): recipe is Recipe => Boolean(recipe));

  if (selectedRecipes.length > 0) {
    overview.push(`Keeps variety with ${selectedRecipes.length} unique recipe${selectedRecipes.length > 1 ? "s" : ""}`);
  }

  const overlappingIngredients = new Map<string, number>();

  for (const recipe of selectedRecipes) {
    const names = new Set(recipe.ingredients.map((ingredient) => normalizeText(ingredient.name)));

    for (const name of names) {
      overlappingIngredients.set(name, (overlappingIngredients.get(name) ?? 0) + 1);
    }
  }

  const strongestOverlap = Array.from(overlappingIngredients.entries())
    .filter(([, count]) => count >= 2)
    .toSorted((left, right) => right[1] - left[1])
    .slice(0, 2)
    .map(([name]) => name);

  if (strongestOverlap.length > 0) {
    overview.push(`Reuses ${strongestOverlap.join(" and ")} across multiple meals`);
  }

  if (constraints.maxTotalMinutes > 0) {
    overview.push(`Targets a ${constraints.maxTotalMinutes}-minute weekly cooking cap`);
  }

  return overview.slice(0, 3);
}

function pickRecommendationPlan(
  recipes: Recipe[],
  constraints: PlannerConstraints,
  allowOverTime: boolean
): RecommendationResult {
  const filteredRecipes =
    constraints.tagFilters.length === 0
      ? recipes
      : recipes.filter((recipe) => recipe.tags.some((tag) => constraints.tagFilters.includes(tag)));

  if (filteredRecipes.length === 0) {
    return {
      suggestions: [],
      warning: "No saved recipes match your current filters yet. Try removing a filter or adding more recipes.",
      totalMinutes: 0,
      totalPortions: 0,
      overview: []
    };
  }

  const pickedRecipeIds = new Set<string>();
  const suggestions: UnscheduledMeal[] = [];
  let totalMinutes = 0;
  let totalPortions = 0;

  while (pickedRecipeIds.size < constraints.preferredUniqueRecipes) {
    const selectedRecipes = suggestions
      .map((suggestion) => filteredRecipes.find((recipe) => recipe.id === suggestion.recipeId))
      .filter((recipe): recipe is Recipe => Boolean(recipe));

    const nextCandidate = filteredRecipes
      .filter((recipe) => !pickedRecipeIds.has(recipe.id))
      .map((recipe) => ({
        recipe,
        score: scoreRecipe(recipe, selectedRecipes, constraints)
      }))
      .toSorted((left, right) => right.score - left.score)
      .find(({ recipe }) => allowOverTime || totalMinutes + recipe.totalTimeMinutes <= constraints.maxTotalMinutes);

    if (!nextCandidate) {
      break;
    }

    pickedRecipeIds.add(nextCandidate.recipe.id);
    suggestions.push({
      id: crypto.randomUUID(),
      recipeId: nextCandidate.recipe.id,
      plannedPortions: nextCandidate.recipe.portions,
      explanation: buildSuggestionExplanation(nextCandidate.recipe, selectedRecipes, constraints),
      source: "recommendation"
    });
    totalMinutes += nextCandidate.recipe.totalTimeMinutes;
    totalPortions += nextCandidate.recipe.portions;

    if (totalPortions >= constraints.targetPortions) {
      break;
    }
  }

  while (suggestions.length > 0 && totalPortions < constraints.targetPortions) {
    const bestExisting = suggestions
      .map((suggestion) => {
        const recipe = filteredRecipes.find((candidate) => candidate.id === suggestion.recipeId);

        if (!recipe) {
          return null;
        }

        return {
          suggestion,
          recipe,
          score: scoreRecipe(recipe, [], constraints) + recipe.portions * 2
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .toSorted((left, right) => right.score - left.score)
      .find(({ recipe }) => allowOverTime || totalMinutes + recipe.totalTimeMinutes <= constraints.maxTotalMinutes);

    if (!bestExisting) {
      break;
    }

    bestExisting.suggestion.plannedPortions += bestExisting.recipe.portions;
    totalMinutes += bestExisting.recipe.totalTimeMinutes;
    totalPortions += bestExisting.recipe.portions;
  }

  while (totalPortions < constraints.targetPortions) {
    const selectedRecipes = suggestions
      .map((suggestion) => filteredRecipes.find((recipe) => recipe.id === suggestion.recipeId))
      .filter((recipe): recipe is Recipe => Boolean(recipe));

    const fallbackCandidate = filteredRecipes
      .filter((recipe) => !pickedRecipeIds.has(recipe.id))
      .map((recipe) => ({
        recipe,
        score: scoreRecipe(recipe, selectedRecipes, constraints)
      }))
      .toSorted((left, right) => right.score - left.score)
      .find(({ recipe }) => allowOverTime || totalMinutes + recipe.totalTimeMinutes <= constraints.maxTotalMinutes);

    if (!fallbackCandidate) {
      break;
    }

    pickedRecipeIds.add(fallbackCandidate.recipe.id);
    suggestions.push({
      id: crypto.randomUUID(),
      recipeId: fallbackCandidate.recipe.id,
      plannedPortions: fallbackCandidate.recipe.portions,
      explanation: buildSuggestionExplanation(fallbackCandidate.recipe, selectedRecipes, constraints),
      source: "recommendation"
    });
    totalMinutes += fallbackCandidate.recipe.totalTimeMinutes;
    totalPortions += fallbackCandidate.recipe.portions;
  }

  return {
    suggestions,
    totalMinutes,
    totalPortions,
    overview: buildRecommendationOverview(filteredRecipes, suggestions, constraints)
  };
}

export function buildRecommendations(recipes: Recipe[], constraints: PlannerConstraints): RecommendationResult {
  const withinTime = pickRecommendationPlan(recipes, constraints, false);

  if (withinTime.totalPortions >= constraints.targetPortions) {
    return withinTime;
  }

  const fallback = pickRecommendationPlan(recipes, constraints, true);

  if (fallback.suggestions.length === 0) {
    return withinTime;
  }

  return {
    ...fallback,
    warning:
      fallback.totalMinutes > constraints.maxTotalMinutes
        ? "This recommendation meets your meal target, but it goes over the prep time limit."
        : "This is the closest recommendation available with your current recipes."
  };
}

export function removeSuggestionFromRecommendationResult(
  recipes: Recipe[],
  result: RecommendationResult,
  constraints: PlannerConstraints,
  suggestionId: string
): RecommendationResult | null {
  const suggestions = result.suggestions.filter((suggestion) => suggestion.id !== suggestionId);

  if (suggestions.length === 0) {
    return null;
  }

  const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const totalPortions = suggestions.reduce((sum, suggestion) => sum + suggestion.plannedPortions, 0);
  const totalMinutes = suggestions.reduce((sum, suggestion) => {
    const recipe = recipesById.get(suggestion.recipeId);

    if (!recipe) {
      return sum;
    }

    return sum + calculateEstimatedBatches(recipe, suggestion.plannedPortions) * recipe.totalTimeMinutes;
  }, 0);

  return {
    suggestions,
    totalPortions,
    totalMinutes,
    overview: buildRecommendationOverview(recipes, suggestions, constraints),
    warning:
      totalMinutes > constraints.maxTotalMinutes
        ? "This recommendation still goes over the prep time limit."
        : undefined
  };
}

export function summarizeWeekPlan(recipes: Recipe[], weekPlan: WeekPlan): WeekSummary {
  const totalPortionsByRecipeId = new Map<string, number>();

  for (const assignment of weekPlan.dayAssignments) {
    totalPortionsByRecipeId.set(
      assignment.recipeId,
      (totalPortionsByRecipeId.get(assignment.recipeId) ?? 0) + assignment.plannedPortions
    );
  }

  for (const meal of weekPlan.unscheduledMeals) {
    totalPortionsByRecipeId.set(
      meal.recipeId,
      (totalPortionsByRecipeId.get(meal.recipeId) ?? 0) + meal.plannedPortions
    );
  }

  let plannedPortions = 0;
  let totalEstimatedMinutes = 0;

  for (const [recipeId, totalRecipePortions] of totalPortionsByRecipeId.entries()) {
    const recipe = recipes.find((candidate) => candidate.id === recipeId);

    if (!recipe) {
      continue;
    }

    plannedPortions += totalRecipePortions;
    totalEstimatedMinutes += calculateEstimatedBatches(recipe, totalRecipePortions) * recipe.totalTimeMinutes;
  }

  return {
    plannedPortions,
    totalEstimatedMinutes,
    unscheduledCount: weekPlan.unscheduledMeals.length,
    scheduledAssignmentsCount: weekPlan.dayAssignments.length
  };
}

export function buildGroceryList(recipes: Recipe[], weekPlan: WeekPlan): GroceryListData {
  const groupedItems = new Map<string, GroceryListItem>();
  const ingredientRecipeFrequency = new Map<
    string,
    { displayName: string; category: IngredientCategory; recipes: Set<string> }
  >();
  const totalPortionsByRecipeId = new Map<string, number>();

  for (const assignment of weekPlan.dayAssignments) {
    totalPortionsByRecipeId.set(
      assignment.recipeId,
      (totalPortionsByRecipeId.get(assignment.recipeId) ?? 0) + assignment.plannedPortions
    );
  }

  for (const meal of weekPlan.unscheduledMeals) {
    totalPortionsByRecipeId.set(
      meal.recipeId,
      (totalPortionsByRecipeId.get(meal.recipeId) ?? 0) + meal.plannedPortions
    );
  }

  for (const [recipeId, totalPlannedPortions] of totalPortionsByRecipeId.entries()) {
    const recipe = recipes.find((candidate) => candidate.id === recipeId);

    if (!recipe) {
      continue;
    }

    const batches = calculateEstimatedBatches(recipe, totalPlannedPortions);

    for (const ingredient of recipe.ingredients) {
      const normalizedName = normalizeText(ingredient.name);

      if (!normalizedName) {
        continue;
      }

      const amountText =
        batches > 1 ? `${ingredient.amountText} x ${batches} batches` : ingredient.amountText;

      const currentItem = groupedItems.get(normalizedName);

      if (currentItem) {
        currentItem.recipeBreakdown.push({
          recipeName: recipe.name,
          amountText: amountText || "amount not specified"
        });
      } else {
        groupedItems.set(normalizedName, {
          normalizedName,
          displayName: ingredient.name,
          category: ingredient.category,
          recipeBreakdown: [
            {
              recipeName: recipe.name,
              amountText: amountText || "amount not specified"
            }
          ]
        });
      }

      const frequencyEntry = ingredientRecipeFrequency.get(normalizedName);

      if (frequencyEntry) {
        frequencyEntry.recipes.add(recipe.name);
      } else {
        ingredientRecipeFrequency.set(normalizedName, {
          displayName: ingredient.name,
          category: ingredient.category,
          recipes: new Set([recipe.name])
        });
      }
    }
  }

  const items = Array.from(groupedItems.values()).toSorted((left, right) =>
    left.displayName.localeCompare(right.displayName)
  );

  const grouped = ingredientCategories.reduce<Record<IngredientCategory, GroceryListItem[]>>(
    (result, category) => {
      result[category] = items.filter((item) => item.category === category);
      return result;
    },
    {
      Produce: [],
      Dairy: [],
      Protein: [],
      Pantry: [],
      "Spices/Condiments": [],
      Frozen: [],
      Other: []
    }
  );

  const prepOpportunities = Array.from(ingredientRecipeFrequency.entries())
    .filter(([, entry]) => entry.recipes.size >= 2)
    .map(([, entry]) => ({
      ingredient: entry.displayName,
      recipeCount: entry.recipes.size,
      category: entry.category,
      suggestion:
        entry.category === "Produce"
          ? `Prep ${entry.displayName.toLowerCase()} once and divide it across the week.`
          : `Batch prep ${entry.displayName.toLowerCase()} to speed up multiple meals.`
    }))
    .toSorted(
      (left, right) => right.recipeCount - left.recipeCount || left.ingredient.localeCompare(right.ingredient)
    );

  return { grouped, prepOpportunities };
}

export function toTagArray(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .filter((tag, index, array) => array.indexOf(tag) === index);
}

export function createRecipeDraft(memory: IngredientCategoryMemory) {
  const ingredient = createEmptyIngredient();
  return {
    id: "",
    name: "",
    totalTimeMinutes: 25,
    portions: 2,
    tagsText: "",
    ingredients: [
      {
        ...ingredient,
        category: memory[normalizeText(ingredient.name)] ?? ingredient.category
      }
    ],
    notes: ""
  };
}
