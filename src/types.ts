export type IngredientCategory =
  | "Produce"
  | "Dairy"
  | "Protein"
  | "Pantry"
  | "Spices/Condiments"
  | "Frozen"
  | "Other";

export type PreferenceMode =
  | "shared ingredients"
  | "fastest recipes"
  | "balanced"
  | "variety-focused";

export type AppSection = "home" | "recipes" | "planner" | "grocery";

export type RecipeIngredient = {
  id: string;
  name: string;
  amountText: string;
  category: IngredientCategory;
};

export type Recipe = {
  id: string;
  name: string;
  totalTimeMinutes: number;
  portions: number;
  tags: string[];
  ingredients: RecipeIngredient[];
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type PlannedMealSource = "manual" | "recommendation";

export type PlannedMealAssignment = {
  id: string;
  recipeId: string;
  date: string;
  plannedPortions: number;
  source: PlannedMealSource;
  unscheduledMealId?: string;
};

export type UnscheduledMeal = {
  id: string;
  recipeId: string;
  plannedPortions: number;
  explanation: string[];
  source: PlannedMealSource;
};

export type WeekPlan = {
  weekStart: string;
  useSoonIngredients: string[];
  checkedGroceries: string[];
  dayAssignments: PlannedMealAssignment[];
  unscheduledMeals: UnscheduledMeal[];
};

export type WeekPlanStore = {
  selectedWeekStart: string;
  weeksByStart: Record<string, WeekPlan>;
};

export type PlannerConstraints = {
  targetPortions: number;
  preferredUniqueRecipes: number;
  maxTotalMinutes: number;
  tagFilters: string[];
  useSoonIngredients: string[];
  mode: PreferenceMode;
};

export type GroceryListItem = {
  normalizedName: string;
  displayName: string;
  category: IngredientCategory;
  recipeBreakdown: Array<{
    recipeName: string;
    amountText: string;
  }>;
};

export type GroceryPrepOpportunity = {
  ingredient: string;
  recipeCount: number;
  category: IngredientCategory;
  suggestion: string;
};

export type GroceryListData = {
  grouped: Record<IngredientCategory, GroceryListItem[]>;
  prepOpportunities: GroceryPrepOpportunity[];
};

export type RecommendationResult = {
  suggestions: UnscheduledMeal[];
  warning?: string;
  totalPortions: number;
  totalMinutes: number;
  overview: string[];
};

export type IngredientCategoryMemory = Record<string, IngredientCategory>;

export type WeekSummary = {
  plannedPortions: number;
  totalEstimatedMinutes: number;
  unscheduledCount: number;
  scheduledAssignmentsCount: number;
};

export type WeekDay = {
  date: string;
  dayName: string;
  shortDay: string;
  monthLabel: string;
  dayNumber: number;
};

export type AppBootstrapData = {
  recipes: Recipe[];
  ingredientCategoryMemory: IngredientCategoryMemory;
  weekPlanStore: WeekPlanStore;
};
