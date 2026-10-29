/**
 * Fluent Emoji Flat food icons (Microsoft, MIT — assets/food-icons/LICENSE-fluent-emoji.txt).
 * Issue 121. Keys are file names; swapping a file needs no code change.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
export const FOOD_ICON_SOURCES = {
  avocado: require('../../assets/food-icons/avocado.svg'),
  bacon: require('../../assets/food-icons/bacon.svg'),
  baguette_bread: require('../../assets/food-icons/baguette_bread.svg'),
  banana: require('../../assets/food-icons/banana.svg'),
  beans: require('../../assets/food-icons/beans.svg'),
  blueberries: require('../../assets/food-icons/blueberries.svg'),
  bowl_with_spoon: require('../../assets/food-icons/bowl_with_spoon.svg'),
  bread: require('../../assets/food-icons/bread.svg'),
  broccoli: require('../../assets/food-icons/broccoli.svg'),
  burrito: require('../../assets/food-icons/burrito.svg'),
  butter: require('../../assets/food-icons/butter.svg'),
  carrot: require('../../assets/food-icons/carrot.svg'),
  cheese_wedge: require('../../assets/food-icons/cheese_wedge.svg'),
  cherries: require('../../assets/food-icons/cherries.svg'),
  chocolate_bar: require('../../assets/food-icons/chocolate_bar.svg'),
  cooked_rice: require('../../assets/food-icons/cooked_rice.svg'),
  cookie: require('../../assets/food-icons/cookie.svg'),
  croissant: require('../../assets/food-icons/croissant.svg'),
  cup_with_straw: require('../../assets/food-icons/cup_with_straw.svg'),
  cut_of_meat: require('../../assets/food-icons/cut_of_meat.svg'),
  ear_of_corn: require('../../assets/food-icons/ear_of_corn.svg'),
  egg: require('../../assets/food-icons/egg.svg'),
  fish: require('../../assets/food-icons/fish.svg'),
  glass_of_milk: require('../../assets/food-icons/glass_of_milk.svg'),
  grapes: require('../../assets/food-icons/grapes.svg'),
  green_salad: require('../../assets/food-icons/green_salad.svg'),
  hamburger: require('../../assets/food-icons/hamburger.svg'),
  hot_beverage: require('../../assets/food-icons/hot_beverage.svg'),
  ice_cream: require('../../assets/food-icons/ice_cream.svg'),
  kiwi_fruit: require('../../assets/food-icons/kiwi_fruit.svg'),
  leafy_green: require('../../assets/food-icons/leafy_green.svg'),
  lemon: require('../../assets/food-icons/lemon.svg'),
  mango: require('../../assets/food-icons/mango.svg'),
  mushroom: require('../../assets/food-icons/mushroom.svg'),
  pancakes: require('../../assets/food-icons/pancakes.svg'),
  peach: require('../../assets/food-icons/peach.svg'),
  peanuts: require('../../assets/food-icons/peanuts.svg'),
  pear: require('../../assets/food-icons/pear.svg'),
  pineapple: require('../../assets/food-icons/pineapple.svg'),
  pizza: require('../../assets/food-icons/pizza.svg'),
  potato: require('../../assets/food-icons/potato.svg'),
  poultry_leg: require('../../assets/food-icons/poultry_leg.svg'),
  red_apple: require('../../assets/food-icons/red_apple.svg'),
  sandwich: require('../../assets/food-icons/sandwich.svg'),
  shrimp: require('../../assets/food-icons/shrimp.svg'),
  spaghetti: require('../../assets/food-icons/spaghetti.svg'),
  steaming_bowl: require('../../assets/food-icons/steaming_bowl.svg'),
  strawberry: require('../../assets/food-icons/strawberry.svg'),
  tangerine: require('../../assets/food-icons/tangerine.svg'),
  tomato: require('../../assets/food-icons/tomato.svg'),
  watermelon: require('../../assets/food-icons/watermelon.svg'),
} as const;

export type FoodIconKey = keyof typeof FOOD_ICON_SOURCES;

/** Fallback for foods with no keyword match — never a system emoji. */
export const FALLBACK_FOOD_ICON: FoodIconKey = 'bowl_with_spoon';
