import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode
} from "react";
import {
  bootstrapAppData,
  buildGroceryList,
  buildIngredientCategoryMemory,
  buildRecommendations,
  calculateEstimatedBatches,
  createEmptyIngredient,
  createEmptyWeekPlan,
  createRecipeDraft,
  defaultConstraints,
  formatWeekRangeLabel,
  getUniqueIngredientNames,
  getUniqueTags,
  getWeekDays,
  getWeekPlan,
  ingredientCategories,
  matchesRecipeSearch,
  normalizeText,
  removeSuggestionFromRecommendationResult,
  shiftWeekStart,
  STORAGE_KEYS,
  summarizeWeekPlan,
  toTagArray
} from "./mealmaster";
import { writeStorage } from "./storage";
import type {
  AppBootstrapData,
  AppSection,
  GroceryListItem,
  IngredientCategoryMemory,
  PlannedMealAssignment,
  PlannerConstraints,
  Recipe,
  RecipeIngredient,
  RecommendationResult,
  UnscheduledMeal,
  WeekDay,
  WeekPlan,
  WeekPlanStore
} from "./types";

type RecipeDraft = {
  id: string;
  name: string;
  totalTimeMinutes: number;
  portions: number;
  tagsText: string;
  ingredients: RecipeIngredient[];
  notes: string;
};

type RecipeCardProps = {
  recipe: Recipe;
  isInSelectedWeek: boolean;
  onView: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAddToQueue: () => void;
};

type SectionButtonProps = {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
};

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
};

type EmptyStateProps = {
  eyebrow: string;
  title: string;
  detail: string;
  action?: ReactNode;
};

type WeekNavigatorProps = {
  weekLabel: string;
  onPrevious: () => void;
  onNext: () => void;
};

type RecipeFormModalProps = {
  isOpen: boolean;
  draft: RecipeDraft;
  error: string | null;
  categoryMemory: IngredientCategoryMemory;
  onClose: () => void;
  onSave: () => void;
  onFieldChange: (field: keyof Omit<RecipeDraft, "ingredients">, value: string | number) => void;
  onIngredientChange: (
    ingredientId: string,
    field: keyof RecipeIngredient,
    value: string
  ) => void;
  onAddIngredient: () => void;
  onRemoveIngredient: (ingredientId: string) => void;
};

type RecipeDetailSheetProps = {
  recipe: Recipe | null;
  isInSelectedWeek: boolean;
  onClose: () => void;
  onEdit: () => void;
  onAddToQueue: () => void;
};

type RecommendationPanelProps = {
  constraints: PlannerConstraints;
  allTags: string[];
  allIngredients: string[];
  hasRecipes: boolean;
  result: RecommendationResult | null;
  recipesById: Map<string, Recipe>;
  onConstraintChange: (field: keyof PlannerConstraints, value: number | string[]) => void;
  onTagToggle: (tag: string) => void;
  onUseSoonToggle: (ingredientName: string) => void;
  onGenerate: () => void;
  onApply: () => void;
  onApplySuggestion: (suggestionId: string) => void;
};

type UnscheduledMealCardProps = {
  meal: UnscheduledMeal;
  recipe: Recipe;
  weekDays: WeekDay[];
  onAssign: (date: string, plannedPortions: number) => void;
  onRemove: () => void;
};

type DayCardProps = {
  day: WeekDay;
  recipes: Recipe[];
  assignments: Array<PlannedMealAssignment & { recipe: Recipe }>;
  onAddMeal: (recipeId: string, plannedPortions: number) => void;
  onChangePortions: (assignmentId: string, plannedPortions: number) => void;
  onRemove: (assignmentId: string) => void;
};

type GroceryColumnProps = {
  title: string;
  items: GroceryListItem[];
  checkedGroceries: string[];
  onToggle: (normalizedName: string) => void;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function formatMinutes(minutes: number) {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `${hours} hr` : `${hours} hr ${remainingMinutes} min`;
}

function prioritizeIngredientNames(allIngredientNames: string[], prioritizedIngredientNames: string[]) {
  const prioritySet = new Set(prioritizedIngredientNames.map((name) => normalizeText(name)));
  const prioritized: string[] = [];
  const remaining: string[] = [];

  for (const ingredientName of allIngredientNames) {
    if (prioritySet.has(normalizeText(ingredientName))) {
      prioritized.push(ingredientName);
    } else {
      remaining.push(ingredientName);
    }
  }

  return [...prioritized, ...remaining];
}

function recipeToDraft(recipe: Recipe): RecipeDraft {
  return {
    id: recipe.id,
    name: recipe.name,
    totalTimeMinutes: recipe.totalTimeMinutes,
    portions: recipe.portions,
    tagsText: recipe.tags.join(", "),
    ingredients: recipe.ingredients.map((ingredient) => ({ ...ingredient })),
    notes: recipe.notes
  };
}

function SectionButton({ active, label, count, onClick }: SectionButtonProps) {
  return (
    <button className={cx("section-tab", active && "section-tab-active")} type="button" onClick={onClick}>
      <span>{label}</span>
      {typeof count === "number" ? <span className="section-count">{count}</span> : null}
    </button>
  );
}

function MetricCard({ label, value, detail }: MetricCardProps) {
  return (
    <article className="metric-card">
      <p className="metric-label">{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}

function EmptyState({ eyebrow, title, detail, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <p className="eyebrow">{eyebrow}</p>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}

function WeekNavigator({ weekLabel, onPrevious, onNext }: WeekNavigatorProps) {
  return (
    <div className="week-nav">
      <button className="ghost-button" type="button" onClick={onPrevious}>
        Previous Week
      </button>
      <div className="week-label-block">
        <p className="eyebrow">Selected week</p>
        <h2>{weekLabel}</h2>
      </div>
      <button className="ghost-button" type="button" onClick={onNext}>
        Next Week
      </button>
    </div>
  );
}

function RecipeCard({
  recipe,
  isInSelectedWeek,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
  onAddToQueue
}: RecipeCardProps) {
  return (
    <article className="recipe-card">
      <div className="recipe-card-top">
        <div>
          <p className="recipe-meta">
            <ClockIcon />
            <span>{formatMinutes(recipe.totalTimeMinutes)}</span>
          </p>
          <h3>{recipe.name}</h3>
        </div>
        {isInSelectedWeek ? <span className="status-pill">In Selected Week</span> : null}
      </div>
      <div className="tag-row">
        {recipe.tags.map((tag) => (
          <span key={tag} className="tag-chip">
            {tag}
          </span>
        ))}
      </div>
      <p className="recipe-preview">
        {recipe.ingredients.slice(0, 3).map((ingredient) => ingredient.name).join(", ")}
        {recipe.ingredients.length > 3 ? ` +${recipe.ingredients.length - 3} more` : ""}
      </p>
      <div className="card-footer">
        <button className="ghost-button" type="button" onClick={onView}>
          View Details
        </button>
        <button className="primary-button" type="button" onClick={onAddToQueue}>
          Add to Week Queue
        </button>
      </div>
      <div className="card-toolbar">
        <button className="toolbar-link" type="button" onClick={onEdit}>
          Edit
        </button>
        <button className="toolbar-link" type="button" onClick={onDuplicate}>
          Duplicate
        </button>
        <button className="toolbar-link danger-link" type="button" onClick={onDelete}>
          Delete
        </button>
      </div>
    </article>
  );
}

function DayCard({ day, recipes, assignments, onAddMeal, onChangePortions, onRemove }: DayCardProps) {
  const [selectedRecipeId, setSelectedRecipeId] = useState(recipes[0]?.id ?? "");
  const [plannedPortions, setPlannedPortions] = useState(2);
  const [isAddMealOpen, setIsAddMealOpen] = useState(false);
  const isFilled = assignments.length > 0;

  useEffect(() => {
    if (recipes.length > 0 && !recipes.some((recipe) => recipe.id === selectedRecipeId)) {
      setSelectedRecipeId(recipes[0].id);
    }
  }, [recipes, selectedRecipeId]);

  return (
    <article className={cx("day-card", isFilled && "day-card-filled")}>
      <div className="day-card-header">
        <div>
          <p className="eyebrow">{day.monthLabel}</p>
          <h3>
            {day.dayName} <span>{day.dayNumber}</span>
          </h3>
        </div>
        <div className="day-card-header-actions">
          {isFilled ? (
            <span className="status-pill">
              {assignments.length} meal{assignments.length === 1 ? "" : "s"} planned
            </span>
          ) : null}
          <button
            className={cx("icon-button", "day-add-toggle", isAddMealOpen && "day-add-toggle-open")}
            type="button"
            aria-expanded={isAddMealOpen}
            aria-label={isAddMealOpen ? `Hide add meal for ${day.dayName}` : `Show add meal for ${day.dayName}`}
            onClick={() => setIsAddMealOpen((current) => !current)}
          >
            <PlusIcon />
          </button>
        </div>
      </div>

      {assignments.length === 0 ? (
        <div className="day-empty">
          <p>No meals assigned yet for this day.</p>
        </div>
      ) : (
        <div className="assignment-stack">
          {assignments.map((assignment) => (
            <div key={assignment.id} className="assignment-item">
              <div>
                <strong>{assignment.recipe.name}</strong>
                <p>
                  {assignment.plannedPortions} planned portion{assignment.plannedPortions > 1 ? "s" : ""} /{" "}
                  {calculateEstimatedBatches(assignment.recipe, assignment.plannedPortions)} batch
                  {calculateEstimatedBatches(assignment.recipe, assignment.plannedPortions) > 1 ? "es" : ""}
                </p>
              </div>
              <div className="assignment-actions">
                <div className="inline-stepper">
                  <button
                    type="button"
                    onClick={() => onChangePortions(assignment.id, Math.max(1, assignment.plannedPortions - 1))}
                  >
                    -
                  </button>
                  <span>{assignment.plannedPortions}</span>
                  <button type="button" onClick={() => onChangePortions(assignment.id, assignment.plannedPortions + 1)}>
                    +
                  </button>
                </div>
                <button className="toolbar-link danger-link" type="button" onClick={() => onRemove(assignment.id)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isAddMealOpen ? (
        <div className="day-add-panel">
          <h4>Add meal</h4>
          {recipes.length === 0 ? (
            <p className="grocery-empty">Save recipes first to add meals to this day.</p>
          ) : (
            <>
              <select value={selectedRecipeId} onChange={(event) => setSelectedRecipeId(event.target.value)}>
                {recipes.map((recipe) => (
                  <option key={recipe.id} value={recipe.id}>
                    {recipe.name}
                  </option>
                ))}
              </select>
              <div className="day-add-actions">
                <input
                  type="number"
                  min={1}
                  value={plannedPortions}
                  onChange={(event) => setPlannedPortions(Math.max(1, Number(event.target.value) || 1))}
                />
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => {
                    if (!selectedRecipeId) {
                      return;
                    }

                    onAddMeal(selectedRecipeId, Math.max(1, plannedPortions));
                    setPlannedPortions(1);
                    setIsAddMealOpen(false);
                  }}
                >
                  Add Meal
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </article>
  );
}

function RecommendationPanel({
  constraints,
  allTags,
  allIngredients,
  hasRecipes,
  result,
  recipesById,
  onConstraintChange,
  onTagToggle,
  onUseSoonToggle,
  onGenerate,
  onApply,
  onApplySuggestion
}: RecommendationPanelProps) {
  const [ingredientSearchTerm, setIngredientSearchTerm] = useState("");
  const [isUseSoonExpanded, setIsUseSoonExpanded] = useState(false);
  const normalizedIngredientSearchTerm = normalizeText(ingredientSearchTerm);
  const isSearchingIngredients = normalizedIngredientSearchTerm.length > 0;
  const collapsedIngredientLimit = 8;
  const filteredIngredients = useMemo(() => {
    if (!isSearchingIngredients) {
      return allIngredients;
    }

    return allIngredients.filter((ingredientName) =>
      normalizeText(ingredientName).includes(normalizedIngredientSearchTerm)
    );
  }, [allIngredients, isSearchingIngredients, normalizedIngredientSearchTerm]);
  const visibleIngredients =
    isSearchingIngredients || isUseSoonExpanded
      ? filteredIngredients
      : filteredIngredients.slice(0, collapsedIngredientLimit);
  const hiddenIngredientCount = Math.max(allIngredients.length - collapsedIngredientLimit, 0);

  return (
    <section className="recommendation-card">
      <div className="section-copy">
        <p className="eyebrow">Recommendations</p>
        <h2>Build a weekly plan from your saved recipes</h2>
        <p>
          Generate suggestions from your recipe library, then accept them into this week’s unscheduled queue
          and place them on days manually.
        </p>
      </div>

      {!hasRecipes ? (
        <EmptyState
          eyebrow="Recipe library required"
          title="Recommendations need saved recipes first."
          detail="Add a few recipes to your library, then come back here to generate a week that fits your time and portions target."
        />
      ) : (
        <>
          <div className="constraints-grid">
            <label className="field">
              <span>Total portions needed</span>
              <input
                type="number"
                min={1}
                value={constraints.targetPortions}
                onChange={(event) => onConstraintChange("targetPortions", Number(event.target.value))}
              />
            </label>
            <label className="field">
              <span>Preferred unique recipes</span>
              <input
                type="number"
                min={1}
                value={constraints.preferredUniqueRecipes}
                onChange={(event) =>
                  onConstraintChange("preferredUniqueRecipes", Number(event.target.value))
                }
              />
            </label>
            <label className="field">
              <span>Max prep time</span>
              <input
                type="number"
                min={15}
                step={15}
                value={constraints.maxTotalMinutes}
                onChange={(event) => onConstraintChange("maxTotalMinutes", Number(event.target.value))}
              />
            </label>
            <label className="field">
              <span>Preference mode</span>
              <select value={constraints.mode} onChange={(event) => onConstraintChange("mode", [event.target.value])}>
                {["shared ingredients", "fastest recipes", "balanced", "variety-focused"].map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="filter-block">
            <span className="filter-title">Filter by tags</span>
            <div className="chip-row">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  className={cx("filter-chip", constraints.tagFilters.includes(tag) && "filter-chip-active")}
                  type="button"
                  onClick={() => onTagToggle(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-block">
            <span className="filter-title">Use soon this week</span>
            <label className="ingredient-search-field">
              <SearchIcon />
              <input
                type="search"
                value={ingredientSearchTerm}
                onChange={(event) => setIngredientSearchTerm(event.target.value)}
                placeholder="Search ingredients"
                aria-label="Search use soon ingredients"
              />
            </label>
            {visibleIngredients.length > 0 ? (
              <div className="chip-row">
                {visibleIngredients.map((ingredientName) => (
                  <button
                    key={ingredientName}
                    className={cx(
                      "filter-chip",
                      constraints.useSoonIngredients.includes(ingredientName) && "filter-chip-active"
                    )}
                    type="button"
                    onClick={() => onUseSoonToggle(ingredientName)}
                  >
                    {ingredientName}
                  </button>
                ))}
              </div>
            ) : (
              <p className="grocery-empty">No ingredients match that search yet.</p>
            )}
            {!isSearchingIngredients && hiddenIngredientCount > 0 ? (
              <button
                className="toolbar-link"
                type="button"
                onClick={() => setIsUseSoonExpanded((current) => !current)}
              >
                {isUseSoonExpanded ? "Show fewer" : `Show ${hiddenIngredientCount} more`}
              </button>
            ) : null}
          </div>

          <div className="card-footer recommendation-cta">
            <button className="primary-button" type="button" onClick={onGenerate}>
              <SparklesIcon />
              Generate recommendations
            </button>
          </div>

          {result ? (
            <div className="recommendation-result">
              <div className="recommendation-summary">
                <div>
                  <p className="eyebrow">Suggested plan</p>
                  <h3>
                    {result.totalPortions} portions / {formatMinutes(result.totalMinutes)}
                  </h3>
                </div>
                <button className="primary-button" type="button" onClick={onApply}>
                  Add all to unscheduled
                </button>
              </div>

              {result.overview.length > 0 ? (
                <div className="overview-chip-row">
                  {result.overview.map((item) => (
                    <span key={item} className="overview-chip">
                      {item}
                    </span>
                  ))}
                </div>
              ) : null}

              {result.warning ? <p className="callout-warning">{result.warning}</p> : null}

              <div className="recommendation-list">
                {result.suggestions.map((suggestion) => {
                  const recipe = recipesById.get(suggestion.recipeId);

                  if (!recipe) {
                    return null;
                  }

                  return (
                    <article key={suggestion.id} className="recommendation-item">
                      <div>
                        <h4>{recipe.name}</h4>
                        <p>
                          {suggestion.plannedPortions} planned portions /{" "}
                          {calculateEstimatedBatches(recipe, suggestion.plannedPortions)} batch
                          {calculateEstimatedBatches(recipe, suggestion.plannedPortions) > 1 ? "es" : ""}
                        </p>
                        <div className="tag-row small-gap">
                          {suggestion.explanation.map((explanation) => (
                            <span key={explanation} className="tag-chip">
                              {explanation}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="recommendation-item-actions">
                        <span>
                          {formatMinutes(
                            calculateEstimatedBatches(recipe, suggestion.plannedPortions) * recipe.totalTimeMinutes
                          )}
                        </span>
                        <button
                          className="ghost-button recommendation-item-button"
                          type="button"
                          onClick={() => onApplySuggestion(suggestion.id)}
                        >
                          Add to unscheduled
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function UnscheduledMealCard({ meal, recipe, weekDays, onAssign, onRemove }: UnscheduledMealCardProps) {
  const [selectedDate, setSelectedDate] = useState(weekDays[0]?.date ?? "");
  const [plannedPortions, setPlannedPortions] = useState(meal.plannedPortions);

  useEffect(() => {
    if (!weekDays.some((day) => day.date === selectedDate)) {
      setSelectedDate(weekDays[0]?.date ?? "");
    }
  }, [selectedDate, weekDays]);

  return (
    <article className="unscheduled-card">
      <div className="unscheduled-top">
        <div>
          <h3>{recipe.name}</h3>
          <p>
            {plannedPortions} planned portions / {calculateEstimatedBatches(recipe, plannedPortions)} batch
            {calculateEstimatedBatches(recipe, plannedPortions) > 1 ? "es" : ""}
          </p>
        </div>
        <button className="toolbar-link danger-link" type="button" onClick={onRemove}>
          Remove
        </button>
      </div>

      <div className="tag-row small-gap">
        {meal.explanation.map((explanation) => (
          <span key={explanation} className="tag-chip">
            {explanation}
          </span>
        ))}
      </div>

      <div className="unscheduled-actions">
        <label className="field compact-field">
          <span>Choose day</span>
          <select value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)}>
            {weekDays.map((day) => (
              <option key={day.date} value={day.date}>
                {day.dayName}
              </option>
            ))}
          </select>
        </label>
        <label className="field compact-field compact-field-number">
          <span>Portions to assign</span>
          <input
            type="number"
            min={1}
            value={plannedPortions}
            onChange={(event) => setPlannedPortions(Math.max(1, Number(event.target.value) || 1))}
          />
        </label>
        <button className="primary-button" type="button" onClick={() => onAssign(selectedDate, plannedPortions)}>
          Assign to Day
        </button>
      </div>
    </article>
  );
}

function RecipeFormModal({
  isOpen,
  draft,
  error,
  categoryMemory,
  onClose,
  onSave,
  onFieldChange,
  onIngredientChange,
  onAddIngredient,
  onRemoveIngredient
}: RecipeFormModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-shell" role="dialog" aria-modal="true" aria-label="Recipe form">
      <div className="modal-backdrop" onClick={onClose} />
      <section className="modal-panel">
        <div className="modal-header">
          <div>
            <p className="eyebrow">{draft.id ? "Update recipe" : "Add a new recipe"}</p>
            <h2>{draft.id ? "Edit recipe" : "Save a recipe"}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close recipe form">
            <CloseIcon />
          </button>
        </div>

        <div className="form-grid">
          <label className="field">
            <span>Recipe name</span>
            <input
              value={draft.name}
              onChange={(event) => onFieldChange("name", event.target.value)}
              placeholder="Weeknight fried rice"
            />
          </label>
          <label className="field">
            <span>Total time (minutes)</span>
            <input
              type="number"
              min={5}
              step={5}
              value={draft.totalTimeMinutes}
              onChange={(event) => onFieldChange("totalTimeMinutes", Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span>Portions produced</span>
            <input
              type="number"
              min={1}
              value={draft.portions}
              onChange={(event) => onFieldChange("portions", Number(event.target.value))}
            />
          </label>
          <label className="field field-wide">
            <span>Tags</span>
            <input
              value={draft.tagsText}
              onChange={(event) => onFieldChange("tagsText", event.target.value)}
              placeholder="meal prep, high-protein, fast"
            />
          </label>
          <div className="field field-wide">
            <div className="field-row">
              <span>Ingredients</span>
              <button className="ghost-button" type="button" onClick={onAddIngredient}>
                <PlusIcon />
                Add ingredient
              </button>
            </div>
            <div className="ingredient-stack">
              {draft.ingredients.map((ingredient) => {
                const rememberedCategory = categoryMemory[normalizeText(ingredient.name)];

                return (
                  <div key={ingredient.id} className="ingredient-row">
                    <input
                      value={ingredient.name}
                      onChange={(event) => onIngredientChange(ingredient.id, "name", event.target.value)}
                      placeholder="Spinach"
                    />
                    <input
                      value={ingredient.amountText}
                      onChange={(event) => onIngredientChange(ingredient.id, "amountText", event.target.value)}
                      placeholder="1 bag"
                    />
                    <select
                      value={ingredient.category}
                      onChange={(event) => onIngredientChange(ingredient.id, "category", event.target.value)}
                    >
                      {ingredientCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => onRemoveIngredient(ingredient.id)}
                      aria-label="Remove ingredient"
                    >
                      <CloseIcon />
                    </button>
                    {rememberedCategory ? <p className="memory-hint">Suggested: {rememberedCategory}</p> : null}
                  </div>
                );
              })}
            </div>
          </div>
          <label className="field field-wide">
            <span>Prep and cooking notes</span>
            <textarea
              rows={5}
              value={draft.notes}
              onChange={(event) => onFieldChange("notes", event.target.value)}
              placeholder="Roast the peppers while the rice cooks, then toss everything together at the end."
            />
          </label>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="modal-actions">
          <button className="ghost-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="button" onClick={onSave}>
            {draft.id ? "Save Changes" : "Save Recipe"}
          </button>
        </div>
      </section>
    </div>
  );
}

function RecipeDetailSheet({ recipe, isInSelectedWeek, onClose, onEdit, onAddToQueue }: RecipeDetailSheetProps) {
  if (!recipe) {
    return null;
  }

  return (
    <div className="sheet-shell" role="dialog" aria-modal="true" aria-label="Recipe details">
      <div className="modal-backdrop" onClick={onClose} />
      <aside className="sheet-panel">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Recipe details</p>
            <h2>{recipe.name}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close recipe details">
            <CloseIcon />
          </button>
        </div>

        <div className="detail-summary">
          <span>{formatMinutes(recipe.totalTimeMinutes)}</span>
          <span>{recipe.portions} portions</span>
          {isInSelectedWeek ? <span>Already used this week</span> : null}
        </div>

        <div className="tag-row">
          {recipe.tags.map((tag) => (
            <span key={tag} className="tag-chip">
              {tag}
            </span>
          ))}
        </div>

        <div className="detail-block">
          <h3>Ingredients</h3>
          <ul className="detail-list">
            {recipe.ingredients.map((ingredient) => (
              <li key={ingredient.id}>
                <div>
                  <strong>{ingredient.name}</strong>
                  <span>{ingredient.category}</span>
                </div>
                <p>{ingredient.amountText}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="detail-block">
          <h3>Notes</h3>
          <p>{recipe.notes || "No notes yet."}</p>
        </div>

        <div className="modal-actions">
          <button className="ghost-button" type="button" onClick={onEdit}>
            Edit Recipe
          </button>
          <button className="primary-button" type="button" onClick={onAddToQueue}>
            Add to Week Queue
          </button>
        </div>
      </aside>
    </div>
  );
}

function GroceryColumn({ title, items, checkedGroceries, onToggle }: GroceryColumnProps) {
  return (
    <section className="grocery-column">
      <div className="grocery-column-header">
        <h3>{title}</h3>
        <span>{items.length}</span>
      </div>

      <div className="grocery-stack">
        {items.map((item) => {
          const isChecked = checkedGroceries.includes(item.normalizedName);

          return (
            <label key={item.normalizedName} className={cx("grocery-item", isChecked && "grocery-item-checked")}>
              <input type="checkbox" checked={isChecked} onChange={() => onToggle(item.normalizedName)} />
              <div>
                <strong>{item.displayName}</strong>
                <p>
                  Needed for {item.recipeBreakdown.length} recipe{item.recipeBreakdown.length === 1 ? "" : "s"}
                </p>
                <span>
                  {item.recipeBreakdown
                    .map((entry) => `${entry.recipeName} (${entry.amountText || "amount not specified"})`)
                    .join(", ")}
                </span>
              </div>
            </label>
          );
        })}
      </div>
    </section>
  );
}

function App() {
  const [initialData] = useState<AppBootstrapData>(() => bootstrapAppData());
  const [recipes, setRecipes] = useState<Recipe[]>(initialData.recipes);
  const [weekPlanStore, setWeekPlanStore] = useState<WeekPlanStore>(initialData.weekPlanStore);
  const [activeSection, setActiveSection] = useState<AppSection>("home");
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [recommendationResult, setRecommendationResult] = useState<RecommendationResult | null>(null);
  const liveIngredientCategoryMemory = useMemo(
    () => buildIngredientCategoryMemory(recipes),
    [recipes]
  );
  const [draft, setDraft] = useState<RecipeDraft>(() => createRecipeDraft(liveIngredientCategoryMemory));
  const [constraints, setConstraints] = useState<PlannerConstraints>(() => ({
    ...defaultConstraints,
    useSoonIngredients: getWeekPlan(initialData.weekPlanStore, initialData.weekPlanStore.selectedWeekStart).useSoonIngredients
  }));
  const deferredSearchTerm = useDeferredValue(searchTerm);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.recipes, recipes);
  }, [recipes]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.ingredientCategoryMemory, liveIngredientCategoryMemory);
  }, [liveIngredientCategoryMemory]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.weekPlans, weekPlanStore);
  }, [weekPlanStore]);

  const selectedWeekStart = weekPlanStore.selectedWeekStart;
  const currentWeekPlan = useMemo(
    () => getWeekPlan(weekPlanStore, selectedWeekStart),
    [selectedWeekStart, weekPlanStore]
  );

  useEffect(() => {
    setConstraints((current) => ({
      ...current,
      useSoonIngredients: currentWeekPlan.useSoonIngredients
    }));
    setRecommendationResult(null);
  }, [currentWeekPlan.useSoonIngredients, selectedWeekStart]);

  const addRecipeLabel = recipes.length === 0 ? "Add your first recipe" : "Add new recipe";
  const recipesById = useMemo(() => new Map(recipes.map((recipe) => [recipe.id, recipe])), [recipes]);
  const allTags = useMemo(() => getUniqueTags(recipes), [recipes]);
  const allIngredients = useMemo(() => getUniqueIngredientNames(recipes), [recipes]);
  const previousWeekStart = useMemo(() => shiftWeekStart(selectedWeekStart, -1), [selectedWeekStart]);
  const orderedUseSoonIngredients = useMemo(() => {
    const previousWeekPlan = getWeekPlan(weekPlanStore, previousWeekStart);
    const previousWeekGroceryData = buildGroceryList(recipes, previousWeekPlan);
    const previousWeekIngredientNames = Object.values(previousWeekGroceryData.grouped).flatMap((items) =>
      items.map((item) => item.displayName)
    );

    return prioritizeIngredientNames(allIngredients, previousWeekIngredientNames);
  }, [allIngredients, previousWeekStart, recipes, weekPlanStore]);
  const selectedWeekRecipeIds = useMemo(
    () =>
      new Set([
        ...currentWeekPlan.dayAssignments.map((assignment) => assignment.recipeId),
        ...currentWeekPlan.unscheduledMeals.map((meal) => meal.recipeId)
      ]),
    [currentWeekPlan.dayAssignments, currentWeekPlan.unscheduledMeals]
  );
  const filteredRecipes = useMemo(
    () =>
      recipes
        .filter((recipe) => matchesRecipeSearch(recipe, deferredSearchTerm))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [deferredSearchTerm, recipes]
  );
  const selectedRecipe = selectedRecipeId ? recipesById.get(selectedRecipeId) ?? null : null;
  const weekDays = useMemo(() => getWeekDays(selectedWeekStart), [selectedWeekStart]);
  const weekLabel = useMemo(() => formatWeekRangeLabel(selectedWeekStart), [selectedWeekStart]);
  const weekSummary = useMemo(() => summarizeWeekPlan(recipes, currentWeekPlan), [currentWeekPlan, recipes]);
  const groceryData = useMemo(() => buildGroceryList(recipes, currentWeekPlan), [currentWeekPlan, recipes]);
  const assignmentsByDate = useMemo(() => {
    const grouped = new Map<string, Array<PlannedMealAssignment & { recipe: Recipe }>>();

    for (const assignment of currentWeekPlan.dayAssignments) {
      const recipe = recipesById.get(assignment.recipeId);

      if (!recipe) {
        continue;
      }

      const currentAssignments = grouped.get(assignment.date) ?? [];
      currentAssignments.push({ ...assignment, recipe });
      grouped.set(assignment.date, currentAssignments);
    }

    return grouped;
  }, [currentWeekPlan.dayAssignments, recipesById]);

  function updateCurrentWeekPlan(updater: (weekPlan: WeekPlan) => WeekPlan) {
    setWeekPlanStore((current) => {
      const selectedPlan = getWeekPlan(current, current.selectedWeekStart);
      const nextWeekPlan = updater(selectedPlan);
      return {
        ...current,
        weeksByStart: {
          ...current.weeksByStart,
          [current.selectedWeekStart]: nextWeekPlan
        }
      };
    });
  }

  function openCreateRecipe() {
    setFormError(null);
    setDraft(createRecipeDraft(liveIngredientCategoryMemory));
    setIsFormOpen(true);
  }

  function openEditRecipe(recipe: Recipe) {
    setFormError(null);
    setDraft(recipeToDraft(recipe));
    setIsFormOpen(true);
  }

  function closeRecipeModal() {
    setIsFormOpen(false);
    setFormError(null);
  }

  function updateDraftField(field: keyof Omit<RecipeDraft, "ingredients">, value: string | number) {
    setDraft((current) => ({
      ...current,
      [field]: value
    }));
  }

  function updateDraftIngredient(ingredientId: string, field: keyof RecipeIngredient, value: string) {
    setDraft((current) => ({
      ...current,
      ingredients: current.ingredients.map((ingredient) => {
        if (ingredient.id !== ingredientId) {
          return ingredient;
        }

        if (field === "name") {
          const rememberedCategory = liveIngredientCategoryMemory[normalizeText(value)];
          return {
            ...ingredient,
            name: value,
            category: rememberedCategory ?? ingredient.category
          };
        }

        return {
          ...ingredient,
          [field]: value
        };
      })
    }));
  }

  function addIngredientRow() {
    setDraft((current) => ({
      ...current,
      ingredients: [...current.ingredients, createEmptyIngredient()]
    }));
  }

  function removeIngredientRow(ingredientId: string) {
    setDraft((current) => ({
      ...current,
      ingredients:
        current.ingredients.length === 1
          ? current.ingredients
          : current.ingredients.filter((ingredient) => ingredient.id !== ingredientId)
    }));
  }

  function saveRecipe() {
    const trimmedName = draft.name.trim();
    const cleanedIngredients = draft.ingredients
      .map((ingredient) => ({
        ...ingredient,
        name: ingredient.name.trim(),
        amountText: ingredient.amountText.trim()
      }))
      .filter((ingredient) => ingredient.name);

    if (!trimmedName) {
      setFormError("Add a recipe name so it appears clearly in your library.");
      return;
    }

    if (cleanedIngredients.length === 0) {
      setFormError("Add at least one ingredient before saving this recipe.");
      return;
    }

    const existingRecipe = draft.id ? recipesById.get(draft.id) : undefined;
    const timestamp = new Date().toISOString();
    const nextRecipe: Recipe = {
      id: draft.id || crypto.randomUUID(),
      name: trimmedName,
      totalTimeMinutes: Math.max(5, draft.totalTimeMinutes || 0),
      portions: Math.max(1, draft.portions || 0),
      tags: toTagArray(draft.tagsText),
      ingredients: cleanedIngredients,
      notes: draft.notes.trim(),
      createdAt: existingRecipe?.createdAt ?? timestamp,
      updatedAt: timestamp
    };

    setRecipes((current) => {
      const withoutPrevious = current.filter((recipe) => recipe.id !== nextRecipe.id);
      return [nextRecipe, ...withoutPrevious];
    });

    closeRecipeModal();
  }

  function addRecipeToWeekQueue(recipeId: string, plannedPortions?: number, explanation: string[] = []) {
    const recipe = recipesById.get(recipeId);

    if (!recipe) {
      return;
    }

    updateCurrentWeekPlan((current) => ({
      ...current,
      unscheduledMeals: [
        ...current.unscheduledMeals,
        {
          id: crypto.randomUUID(),
          recipeId,
          plannedPortions: plannedPortions ?? recipe.portions,
          explanation: explanation.length > 0 ? explanation : ["Added manually to this week"],
          source: explanation.length > 0 ? "recommendation" : "manual"
        }
      ],
      checkedGroceries: []
    }));
  }

  function duplicateRecipe(recipeId: string) {
    const recipe = recipesById.get(recipeId);

    if (!recipe) {
      return;
    }

    const timestamp = new Date().toISOString();
    const duplicate: Recipe = {
      ...recipe,
      id: crypto.randomUUID(),
      name: `${recipe.name} Copy`,
      createdAt: timestamp,
      updatedAt: timestamp,
      ingredients: recipe.ingredients.map((ingredient) => ({ ...ingredient, id: crypto.randomUUID() }))
    };

    setRecipes((current) => [duplicate, ...current]);
  }

  function deleteRecipe(recipeId: string) {
    const recipe = recipesById.get(recipeId);

    if (!recipe || !window.confirm(`Delete ${recipe.name}?`)) {
      return;
    }

    setRecipes((current) => current.filter((item) => item.id !== recipeId));
    setWeekPlanStore((current) => ({
      ...current,
      weeksByStart: Object.fromEntries(
        Object.entries(current.weeksByStart).map(([weekStart, weekPlan]) => [
          weekStart,
          {
            ...weekPlan,
            dayAssignments: weekPlan.dayAssignments.filter((assignment) => assignment.recipeId !== recipeId),
            unscheduledMeals: weekPlan.unscheduledMeals.filter((meal) => meal.recipeId !== recipeId),
            checkedGroceries: []
          }
        ])
      )
    }));

    if (selectedRecipeId === recipeId) {
      setSelectedRecipeId(null);
    }
  }

  function addDayAssignment(date: string, recipeId: string, plannedPortions: number, unscheduledMealId?: string) {
    updateCurrentWeekPlan((current) => ({
      ...current,
      dayAssignments: [
        ...current.dayAssignments,
        {
          id: crypto.randomUUID(),
          recipeId,
          date,
          plannedPortions: Math.max(1, plannedPortions),
          source: unscheduledMealId ? "recommendation" : "manual",
          unscheduledMealId
        }
      ],
      unscheduledMeals: unscheduledMealId
        ? current.unscheduledMeals.filter((meal) => meal.id !== unscheduledMealId)
        : current.unscheduledMeals,
      checkedGroceries: []
    }));
  }

  function updateAssignmentPortions(assignmentId: string, plannedPortions: number) {
    updateCurrentWeekPlan((current) => ({
      ...current,
      dayAssignments: current.dayAssignments.map((assignment) =>
        assignment.id === assignmentId
          ? { ...assignment, plannedPortions: Math.max(1, plannedPortions) }
          : assignment
      ),
      checkedGroceries: []
    }));
  }

  function removeAssignment(assignmentId: string) {
    updateCurrentWeekPlan((current) => ({
      ...current,
      dayAssignments: current.dayAssignments.filter((assignment) => assignment.id !== assignmentId),
      checkedGroceries: []
    }));
  }

  function removeUnscheduledMeal(mealId: string) {
    updateCurrentWeekPlan((current) => ({
      ...current,
      unscheduledMeals: current.unscheduledMeals.filter((meal) => meal.id !== mealId),
      checkedGroceries: []
    }));
  }

  function updateConstraint(field: keyof PlannerConstraints, value: number | string[]) {
    setConstraints((current) => {
      if (field === "mode" && Array.isArray(value) && value.length > 0) {
        return {
          ...current,
          mode: value[0] as PlannerConstraints["mode"]
        };
      }

      if ((field === "tagFilters" || field === "useSoonIngredients") && Array.isArray(value)) {
        return {
          ...current,
          [field]: value
        };
      }

      return {
        ...current,
        [field]: value as number
      };
    });
  }

  function toggleTag(tag: string) {
    setConstraints((current) => ({
      ...current,
      tagFilters: current.tagFilters.includes(tag)
        ? current.tagFilters.filter((existingTag) => existingTag !== tag)
        : [...current.tagFilters, tag]
    }));
  }

  function toggleUseSoonIngredient(ingredientName: string) {
    const nextUseSoonIngredients = currentWeekPlan.useSoonIngredients.includes(ingredientName)
      ? currentWeekPlan.useSoonIngredients.filter((name) => name !== ingredientName)
      : [...currentWeekPlan.useSoonIngredients, ingredientName];

    setConstraints((current) => ({
      ...current,
      useSoonIngredients: nextUseSoonIngredients
    }));
    updateCurrentWeekPlan((current) => ({
      ...current,
      useSoonIngredients: nextUseSoonIngredients
    }));
  }

  function generateRecommendations() {
    startTransition(() => {
      setRecommendationResult(
        buildRecommendations(recipes, {
          ...constraints,
          useSoonIngredients: currentWeekPlan.useSoonIngredients
        })
      );
    });
  }

  function applyRecommendation() {
    if (!recommendationResult) {
      return;
    }

    updateCurrentWeekPlan((current) => ({
      ...current,
      unscheduledMeals: [
        ...current.unscheduledMeals,
        ...recommendationResult.suggestions.map((suggestion) => ({
          ...suggestion,
          id: crypto.randomUUID()
        }))
      ],
      checkedGroceries: []
    }));
    setRecommendationResult(null);
  }

  function applySingleRecommendation(suggestionId: string) {
    if (!recommendationResult) {
      return;
    }

    const suggestion = recommendationResult.suggestions.find((entry) => entry.id === suggestionId);

    if (!suggestion) {
      return;
    }

    updateCurrentWeekPlan((current) => ({
      ...current,
      unscheduledMeals: [
        ...current.unscheduledMeals,
        {
          ...suggestion,
          id: crypto.randomUUID()
        }
      ],
      checkedGroceries: []
    }));

    setRecommendationResult((current) => {
      if (!current) {
        return null;
      }

      return removeSuggestionFromRecommendationResult(
        recipes,
        current,
        {
          ...constraints,
          useSoonIngredients: currentWeekPlan.useSoonIngredients
        },
        suggestionId
      );
    });
  }

  function toggleCheckedGrocery(normalizedName: string) {
    updateCurrentWeekPlan((current) => ({
      ...current,
      checkedGroceries: current.checkedGroceries.includes(normalizedName)
        ? current.checkedGroceries.filter((item) => item !== normalizedName)
        : [...current.checkedGroceries, normalizedName]
    }));
  }

  function changeSelectedWeek(delta: number) {
    setWeekPlanStore((current) => {
      const nextWeekStart = shiftWeekStart(current.selectedWeekStart, delta);

      return {
        ...current,
        selectedWeekStart: nextWeekStart,
        weeksByStart: current.weeksByStart[nextWeekStart]
          ? current.weeksByStart
          : {
              ...current.weeksByStart,
              [nextWeekStart]: createEmptyWeekPlan(nextWeekStart)
            }
      };
    });
  }

  function resetSelectedWeek() {
    updateCurrentWeekPlan(() => createEmptyWeekPlan(selectedWeekStart));
    setRecommendationResult(null);
  }

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    startTransition(() => {
      setSearchTerm(event.target.value);
    });
  }

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="topbar-brand">
          <div className="brand-mark">
            <BrandIcon />
          </div>
          <div>
            <p className="eyebrow">MealMaster</p>
            <h1>Plan the week like an app, not a sticky note.</h1>
          </div>
        </div>
        <nav className="workspace-nav">
          <SectionButton active={activeSection === "home"} label="Home" onClick={() => setActiveSection("home")} />
          <SectionButton
            active={activeSection === "recipes"}
            label="Recipes"
            count={recipes.length}
            onClick={() => setActiveSection("recipes")}
          />
          <SectionButton
            active={activeSection === "planner"}
            label="Planner"
            count={weekSummary.scheduledAssignmentsCount + weekSummary.unscheduledCount}
            onClick={() => setActiveSection("planner")}
          />
          <SectionButton
            active={activeSection === "grocery"}
            label="Grocery List"
            count={Object.values(groceryData.grouped).reduce((count, items) => count + items.length, 0)}
            onClick={() => setActiveSection("grocery")}
          />
        </nav>
      </header>

      <main className="workspace">
        {activeSection === "home" ? (
          <section className="hero-shell">
            <div className="hero-copy">
              <p className="eyebrow">Home overview</p>
              <h2>Everything for {weekLabel} lives in one place.</h2>
              <p className="hero-detail">
                Save repeatable meals, accept recommendations into this week’s queue, then place them on real
                calendar days and generate a grocery list from the same weekly plan.
              </p>
              <div className="hero-actions">
                <button className="primary-button" type="button" onClick={openCreateRecipe}>
                  <PlusIcon />
                  {addRecipeLabel}
                </button>
                <button className="ghost-button" type="button" onClick={() => setActiveSection("planner")}>
                  Go to Planner
                </button>
              </div>
            </div>

            <div className="hero-metrics">
              <MetricCard label="Recipes saved" value={String(recipes.length)} detail="Your personal recipe library" />
              <MetricCard
                label="Planned portions"
                value={String(weekSummary.plannedPortions)}
                detail={`For ${weekLabel}`}
              />
              <MetricCard
                label="Still to schedule"
                value={String(weekSummary.unscheduledCount)}
                detail="Chosen recipes not placed on a day yet"
              />
            </div>
          </section>
        ) : null}

        {activeSection === "recipes" ? (
          <section className="panel surface-panel">
            <div className="panel-header">
              <div className="section-copy">
                <p className="eyebrow">Recipe library</p>
                <h2>Everything you know how to cook</h2>
                <p>Search by recipe name, ingredient, or tag, then add meals into the selected week’s queue.</p>
              </div>
              <button className="primary-button" type="button" onClick={openCreateRecipe}>
                <PlusIcon />
                {addRecipeLabel}
              </button>
            </div>

            <div className="library-toolbar">
              <label className="search-field">
                <SearchIcon />
                <input
                  value={searchTerm}
                  onChange={handleSearchChange}
                  placeholder="Search recipes, ingredients, or tags"
                />
              </label>
              <p className="toolbar-note">
                {filteredRecipes.length} recipe{filteredRecipes.length === 1 ? "" : "s"} showing
              </p>
            </div>

            {filteredRecipes.length === 0 ? (
              <EmptyState
                eyebrow="No recipes yet"
                title="Your recipe library is still empty."
                detail="Add a few recipes so recommendations, day planning, and grocery generation have something to work from."
                action={
                  <button className="primary-button" type="button" onClick={openCreateRecipe}>
                    {addRecipeLabel}
                  </button>
                }
              />
            ) : (
              <div className="recipe-grid">
                {filteredRecipes.map((recipe) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    isInSelectedWeek={selectedWeekRecipeIds.has(recipe.id)}
                    onView={() => setSelectedRecipeId(recipe.id)}
                    onEdit={() => openEditRecipe(recipe)}
                    onDuplicate={() => duplicateRecipe(recipe.id)}
                    onDelete={() => deleteRecipe(recipe.id)}
                    onAddToQueue={() => addRecipeToWeekQueue(recipe.id)}
                  />
                ))}
              </div>
            )}
          </section>
        ) : null}

        {activeSection === "planner" ? (
          <section className="planner-page">
            <div className="planner-header-card">
              <WeekNavigator
                weekLabel={weekLabel}
                onPrevious={() => changeSelectedWeek(-1)}
                onNext={() => changeSelectedWeek(1)}
              />
              <div className="summary-band">
                <MetricCard
                  label="Planned portions"
                  value={String(weekSummary.plannedPortions)}
                  detail="Scheduled and unscheduled meals combined"
                />
                <MetricCard
                  label="Estimated cooking time"
                  value={formatMinutes(weekSummary.totalEstimatedMinutes)}
                  detail="Based on whole recipe batches for this week"
                />
                <MetricCard
                  label="Waiting for day assignment"
                  value={String(weekSummary.unscheduledCount)}
                  detail="Recipes chosen for this week but not on the calendar yet"
                />
              </div>
              <div className="planner-header-actions">
                <button className="ghost-button" type="button" onClick={resetSelectedWeek}>
                  Reset selected week
                </button>
              </div>
            </div>

            <div className="planner-top-grid">
              <RecommendationPanel
                constraints={constraints}
                allTags={allTags}
                allIngredients={orderedUseSoonIngredients}
                hasRecipes={recipes.length > 0}
                result={recommendationResult}
                recipesById={recipesById}
                onConstraintChange={updateConstraint}
                onTagToggle={toggleTag}
                onUseSoonToggle={toggleUseSoonIngredient}
                onGenerate={generateRecommendations}
                onApply={applyRecommendation}
                onApplySuggestion={applySingleRecommendation}
              />

              <section className="panel surface-panel">
                <div className="section-copy">
                  <p className="eyebrow">Unscheduled meals for this week</p>
                  <h2>Meals waiting to be scheduled</h2>
                  <p>
                    These are recipes already chosen for this selected week, but not yet placed on a specific calendar day.
                  </p>
                </div>

                {currentWeekPlan.unscheduledMeals.length === 0 ? (
                  <EmptyState
                    eyebrow="No unscheduled meals"
                    title="Everything accepted for this week is already placed."
                    detail="Add a recipe from the Recipes tab or accept a recommendation to build this queue."
                  />
                ) : (
                  <div className="unscheduled-stack">
                    {currentWeekPlan.unscheduledMeals.map((meal) => {
                      const recipe = recipesById.get(meal.recipeId);

                      if (!recipe) {
                        return null;
                      }

                      return (
                        <UnscheduledMealCard
                          key={meal.id}
                          meal={meal}
                          recipe={recipe}
                          weekDays={weekDays}
                          onAssign={(date, plannedPortions) =>
                            addDayAssignment(date, meal.recipeId, plannedPortions, meal.id)
                          }
                          onRemove={() => removeUnscheduledMeal(meal.id)}
                        />
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            <section className="panel surface-panel">
              <div className="panel-header">
                <div className="section-copy">
                  <p className="eyebrow">Calendar planner</p>
                  <h2>Plan meals by day</h2>
                  <p>Each day holds multiple meals, repeat recipes across the week, and portion each assignment separately.</p>
                </div>
              </div>

              <div className="calendar-grid">
                {weekDays.map((day) => (
                  <DayCard
                    key={day.date}
                    day={day}
                    recipes={recipes}
                    assignments={assignmentsByDate.get(day.date) ?? []}
                    onAddMeal={(recipeId, plannedPortions) => addDayAssignment(day.date, recipeId, plannedPortions)}
                    onChangePortions={updateAssignmentPortions}
                    onRemove={removeAssignment}
                  />
                ))}
              </div>
            </section>
          </section>
        ) : null}

        {activeSection === "grocery" ? (
          <section className="panel surface-panel">
            <div className="panel-header">
              <div className="section-copy">
                <p className="eyebrow">Grocery list</p>
                <h2>Shop for {weekLabel}</h2>
                <p>
                  The grocery list is generated from the currently selected week, including accepted unscheduled meals that still need a day.
                </p>
              </div>
            </div>

            <WeekNavigator
              weekLabel={weekLabel}
              onPrevious={() => changeSelectedWeek(-1)}
              onNext={() => changeSelectedWeek(1)}
            />

            {currentWeekPlan.dayAssignments.length === 0 && currentWeekPlan.unscheduledMeals.length === 0 ? (
              <EmptyState
                eyebrow="Nothing planned yet"
                title="No meals are planned for this selected week."
                detail="Add meals to the selected week from Recipes or accept recommendations in Planner, then this grocery list will populate automatically."
              />
            ) : (
              <>
                <div className="grocery-grid">
                  {Object.entries(groceryData.grouped)
                    .filter(([, items]) => items.length > 0)
                    .map(([category, items]) => (
                    <GroceryColumn
                      key={category}
                      title={category}
                      items={items}
                      checkedGroceries={currentWeekPlan.checkedGroceries}
                      onToggle={toggleCheckedGrocery}
                    />
                  ))}
                </div>

                <section className="prep-panel">
                  <div className="section-copy">
                    <p className="eyebrow">Shared prep opportunities</p>
                    <h3>Prep once, use twice</h3>
                  </div>

                  {groceryData.prepOpportunities.length === 0 ? (
                    <p className="grocery-empty">Once ingredients overlap across planned meals, MealMaster will surface prep wins here.</p>
                  ) : (
                    <div className="prep-grid">
                      {groceryData.prepOpportunities.map((item) => (
                        <article key={item.ingredient} className="prep-card">
                          <strong>{item.ingredient}</strong>
                          <span>
                            Used in {item.recipeCount} recipe{item.recipeCount > 1 ? "s" : ""}
                          </span>
                          <p>{item.suggestion}</p>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </section>
        ) : null}
      </main>

      <RecipeFormModal
        isOpen={isFormOpen}
        draft={draft}
        error={formError}
        categoryMemory={liveIngredientCategoryMemory}
        onClose={closeRecipeModal}
        onSave={saveRecipe}
        onFieldChange={updateDraftField}
        onIngredientChange={updateDraftIngredient}
        onAddIngredient={addIngredientRow}
        onRemoveIngredient={removeIngredientRow}
      />

      <RecipeDetailSheet
        recipe={selectedRecipe}
        isInSelectedWeek={Boolean(selectedRecipe && selectedWeekRecipeIds.has(selectedRecipe.id))}
        onClose={() => setSelectedRecipeId(null)}
        onEdit={() => {
          if (selectedRecipe) {
            openEditRecipe(selectedRecipe);
            setSelectedRecipeId(null);
          }
        }}
        onAddToQueue={() => {
          if (selectedRecipe) {
            addRecipeToWeekQueue(selectedRecipe.id);
          }
        }}
      />
    </div>
  );
}

function BrandIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect x="3" y="3" width="42" height="42" rx="15" fill="currentColor" opacity="0.12" />
      <path
        d="M14 29c0-7 4.5-12 11-12s9 4.2 9 8.4c0 6.7-5 10.6-12 10.6-5 0-8-2.8-8-7Z"
        fill="currentColor"
      />
      <path
        d="M24 14c1.4 3.6 4.5 5.5 9.2 5.8-1.4-4.6-4.5-6.6-9.2-5.8Z"
        fill="#ffffff"
        opacity="0.9"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 5.8v4.4l2.7 1.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="9" cy="9" r="5.75" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="m13.4 13.4 3 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 2.5 11.8 7l4.7 1.8-4.7 1.8-1.8 4.4-1.8-4.4L3.5 8.8 8.2 7 10 2.5Z" fill="currentColor" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 4v12M4 10h12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M5 5 15 15M15 5 5 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default App;
