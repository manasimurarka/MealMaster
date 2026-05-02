import type { Recipe } from "./types";

const now = new Date().toISOString();

export const sampleRecipes: Recipe[] = [
  {
    id: "recipe-burrito-bowl",
    name: "Burrito Bowl",
    totalTimeMinutes: 30,
    portions: 4,
    tags: ["meal prep", "balanced", "vegetarian"],
    ingredients: [
      { id: "bb-1", name: "Brown rice", amountText: "2 cups", category: "Pantry" },
      { id: "bb-2", name: "Black beans", amountText: "2 cans", category: "Pantry" },
      { id: "bb-3", name: "Bell peppers", amountText: "2", category: "Produce" },
      { id: "bb-4", name: "Onion", amountText: "1", category: "Produce" },
      { id: "bb-5", name: "Corn", amountText: "1 cup", category: "Frozen" },
      { id: "bb-6", name: "Greek yogurt", amountText: "1/2 cup", category: "Dairy" }
    ],
    notes:
      "Cook rice first, then saute onions and peppers while the beans warm through. Layer yogurt on top just before serving.",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "recipe-fried-rice",
    name: "Fried Rice",
    totalTimeMinutes: 22,
    portions: 3,
    tags: ["fast", "budget", "meal prep"],
    ingredients: [
      { id: "fr-1", name: "Cooked rice", amountText: "4 cups", category: "Pantry" },
      { id: "fr-2", name: "Eggs", amountText: "3", category: "Dairy" },
      { id: "fr-3", name: "Onion", amountText: "1", category: "Produce" },
      { id: "fr-4", name: "Carrots", amountText: "2", category: "Produce" },
      { id: "fr-5", name: "Frozen peas", amountText: "1 cup", category: "Frozen" },
      { id: "fr-6", name: "Bell peppers", amountText: "1", category: "Produce" }
    ],
    notes:
      "Use cold rice for the best texture. Scramble the eggs first, then fold them back in after the vegetables soften.",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "recipe-black-bean-quesadilla",
    name: "Black Bean Quesadilla",
    totalTimeMinutes: 18,
    portions: 2,
    tags: ["fast", "vegetarian", "comfort"],
    ingredients: [
      { id: "bq-1", name: "Tortillas", amountText: "4", category: "Pantry" },
      { id: "bq-2", name: "Black beans", amountText: "1 can", category: "Pantry" },
      { id: "bq-3", name: "Onion", amountText: "1/2", category: "Produce" },
      { id: "bq-4", name: "Bell peppers", amountText: "1", category: "Produce" },
      { id: "bq-5", name: "Shredded cheese", amountText: "1 cup", category: "Dairy" },
      { id: "bq-6", name: "Salsa", amountText: "1/3 cup", category: "Spices/Condiments" }
    ],
    notes:
      "Cook the onions and peppers first so the quesadillas stay crisp in the pan and not soggy.",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "recipe-black-bean-patty",
    name: "Black Bean Patty",
    totalTimeMinutes: 28,
    portions: 4,
    tags: ["high-protein", "vegetarian", "meal prep"],
    ingredients: [
      { id: "bp-1", name: "Black beans", amountText: "2 cans", category: "Pantry" },
      { id: "bp-2", name: "Onion", amountText: "1", category: "Produce" },
      { id: "bp-3", name: "Bell peppers", amountText: "1", category: "Produce" },
      { id: "bp-4", name: "Eggs", amountText: "1", category: "Dairy" },
      { id: "bp-5", name: "Breadcrumbs", amountText: "3/4 cup", category: "Pantry" },
      { id: "bp-6", name: "Cumin", amountText: "1 tsp", category: "Spices/Condiments" }
    ],
    notes:
      "Mash most of the beans, leave a few whole for texture, and chill the mixture for 10 minutes before pan-searing.",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "recipe-paneer-onion-sandwich",
    name: "Paneer Onion Sandwich",
    totalTimeMinutes: 15,
    portions: 2,
    tags: ["fast", "vegetarian", "breakfast"],
    ingredients: [
      { id: "ps-1", name: "Paneer", amountText: "200 g", category: "Protein" },
      { id: "ps-2", name: "Onion", amountText: "1", category: "Produce" },
      { id: "ps-3", name: "Bread", amountText: "4 slices", category: "Pantry" },
      { id: "ps-4", name: "Green chilies", amountText: "1", category: "Produce" },
      { id: "ps-5", name: "Butter", amountText: "1 tbsp", category: "Dairy" },
      { id: "ps-6", name: "Chaat masala", amountText: "1 tsp", category: "Spices/Condiments" }
    ],
    notes:
      "Mix crumbled paneer with onions and chaat masala, then toast the sandwiches until the edges turn golden.",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "recipe-paneer-makhani-gravy",
    name: "Paneer Makhani Gravy",
    totalTimeMinutes: 40,
    portions: 4,
    tags: ["vegetarian", "comfort", "dinner"],
    ingredients: [
      { id: "pm-1", name: "Paneer", amountText: "300 g", category: "Protein" },
      { id: "pm-2", name: "Onion", amountText: "1 large", category: "Produce" },
      { id: "pm-3", name: "Tomatoes", amountText: "3", category: "Produce" },
      { id: "pm-4", name: "Garlic", amountText: "4 cloves", category: "Produce" },
      { id: "pm-5", name: "Ginger", amountText: "1 tbsp", category: "Produce" },
      { id: "pm-6", name: "Greek yogurt", amountText: "1/2 cup", category: "Dairy" },
      { id: "pm-7", name: "Butter", amountText: "1 tbsp", category: "Dairy" },
      { id: "pm-8", name: "Garam masala", amountText: "1 tsp", category: "Spices/Condiments" }
    ],
    notes:
      "Blend the onion-tomato base until smooth, then simmer with yogurt and finish with paneer cubes for a silky gravy.",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "recipe-boiled-eggs",
    name: "Boiled Eggs",
    totalTimeMinutes: 12,
    portions: 2,
    tags: ["high-protein", "breakfast", "fast"],
    ingredients: [
      { id: "be-1", name: "Eggs", amountText: "4", category: "Dairy" },
      { id: "be-2", name: "Salt", amountText: "1 pinch", category: "Spices/Condiments" },
      { id: "be-3", name: "Black pepper", amountText: "1 pinch", category: "Spices/Condiments" }
    ],
    notes:
      "Cover eggs with water, bring to a boil, then rest covered off heat so the yolks stay creamy.",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "recipe-vegetable-omelette",
    name: "Vegetable Omelette",
    totalTimeMinutes: 16,
    portions: 2,
    tags: ["breakfast", "high-protein", "fast"],
    ingredients: [
      { id: "vo-1", name: "Eggs", amountText: "4", category: "Dairy" },
      { id: "vo-2", name: "Onion", amountText: "1/2", category: "Produce" },
      { id: "vo-3", name: "Bell peppers", amountText: "1/2", category: "Produce" },
      { id: "vo-4", name: "Carrots", amountText: "1 small", category: "Produce" },
      { id: "vo-5", name: "Frozen peas", amountText: "1/4 cup", category: "Frozen" },
      { id: "vo-6", name: "Cheddar", amountText: "1/4 cup", category: "Dairy" }
    ],
    notes:
      "Saute the vegetables first so the omelette sets quickly and the center stays tender instead of watery.",
    createdAt: now,
    updatedAt: now
  }
];
