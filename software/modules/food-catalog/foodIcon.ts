import type { FoodIconKey } from '@/design-system/components/foodIconAssets';

/**
 * Maps a food name (and optional category) to a Fluent food icon key by
 * keyword (issue 121). Pure; first matching rule wins, so specific phrases
 * come before generic ones (pineapple before apple, peanut butter before
 * butter, hamburger before ham-like words). Unknown foods get the bowl.
 */
const RULES: readonly (readonly [RegExp, FoodIconKey])[] = [
  [/\bpeanut|\balmond|\bcashew|\bwalnut|\bpecan|\bpistachio|\bhazelnut|\bnuts?\b|\bmixed nuts\b/, 'peanuts'],
  [/\bpineapple/, 'pineapple'],
  [/\bsweet potato|\bpotato|\bfries\b|\byam\b/, 'potato'],
  [/\bhamburger|\bburger|\bcheeseburger/, 'hamburger'],
  [/\bsandwich|\bsub\b|\bpanini/, 'sandwich'],
  [/\bburrito|\bwrap\b|\btortilla|\btaco|\bquesadilla/, 'burrito'],
  [/\bpizza/, 'pizza'],
  [/\bspaghetti|\bpasta|\bmacaroni|\bpenne|\blasagn|\bnoodle/, 'spaghetti'],
  [/\bsoup|\bramen|\bpho\b|\bstew|\bchili\b|\bcurry/, 'steaming_bowl'],
  [/\boat|\bporridge|\bcereal|\bgranola|\bmuesli/, 'bowl_with_spoon'],
  [/\bpancake|\bwaffle|\bcrepe/, 'pancakes'],
  [/\bcroissant|\bpastry|\bmuffin/, 'croissant'],
  [/\bbaguette|\bciabatta/, 'baguette_bread'],
  [/\bbread|\btoast|\bbagel|\bbun\b|\broll\b|\bpita/, 'bread'],
  [/\brice\b|\brisotto|\bsushi/, 'cooked_rice'],
  [/\bbacon/, 'bacon'],
  [/\bchicken|\bturkey|\bpoultry|\bduck\b|\bwings?\b/, 'poultry_leg'],
  [/\bbeef|\bsteak|\bpork|\blamb\b|\bveal|\bbison|\bvenison|\bham\b|\bsausage|\bmeat/, 'cut_of_meat'],
  [/\bshrimp|\bprawn|\blobster|\bcrab/, 'shrimp'],
  [/\bfish|\bsalmon|\btuna|\bcod\b|\btilapia|\bhalibut|\btrout|\bsardine|\bmackerel/, 'fish'],
  [/\beggplant|\baubergine/, 'leafy_green'],
  [/\begg/, 'egg'],
  [/\bice cream|\bgelato|\bfrozen yog/, 'ice_cream'],
  [/\bcheese|\bcheddar|\bmozzarella|\bparmesan|\bfeta\b|\bcottage/, 'cheese_wedge'],
  [/\bbutter\b|\bmargarine|\bghee/, 'butter'],
  [/\bmilk|\byogh?urt|\bkefir|\bskyr|\bwhey|\bprotein shake|\bcream\b/, 'glass_of_milk'],
  [/\bchocolate|\bcocoa|\bcandy bar/, 'chocolate_bar'],
  [/\bcookie|\bbiscuit|\bcracker/, 'cookie'],
  [/\bcoffee|\btea\b|\blatte|\bespresso|\bcappuccino/, 'hot_beverage'],
  [/\bjuice|\bsoda|\bsmoothie|\blemonade|\bcola\b|\bsports drink/, 'cup_with_straw'],
  [/\bsalad/, 'green_salad'],
  [/\bspinach|\bkale|\blettuce|\bcabbage|\bchard|\barugula|\bcelery|\bgreens\b|\bcucumber|\bpeas?\b|\bgreen bean|\basparagus|\bzucchini/, 'leafy_green'],
  [/\bbroccoli|\bcauliflower/, 'broccoli'],
  [/\bcarrot/, 'carrot'],
  [/\bcorn\b|\bpopcorn/, 'ear_of_corn'],
  [/\btomato/, 'tomato'],
  [/\bmushroom/, 'mushroom'],
  [/\bavocado|\bguacamole/, 'avocado'],
  [/\bbean|\blentil|\bchickpea|\bhummus|\btofu|\btempeh|\bedamame/, 'beans'],
  [/\bbanana/, 'banana'],
  [/\bapple/, 'red_apple'],
  [/\bpear\b|\bpears\b/, 'pear'],
  [/\bpeach|\bnectarine|\bapricot|\bplum/, 'peach'],
  [/\borange|\btangerine|\bmandarin|\bclementine|\bgrapefruit/, 'tangerine'],
  [/\blemon|\blime\b/, 'lemon'],
  [/\bgrape|\braisin/, 'grapes'],
  [/\bstrawberr/, 'strawberry'],
  [/\bblueberr|\braspberr|\bblackberr|\bcranberr|\bberr/, 'blueberries'],
  [/\bcherr/, 'cherries'],
  [/\bmango/, 'mango'],
  [/\bwatermelon|\bmelon|\bcantaloupe|\bhoneydew/, 'watermelon'],
  [/\bkiwi/, 'kiwi_fruit'],
];

export const FOOD_ICON_FALLBACK: FoodIconKey = 'bowl_with_spoon';

export function foodIconFor(name: string, category?: string | null): FoodIconKey {
  const haystacks = [name, category ?? ''].map((s) => s.toLowerCase());
  for (const text of haystacks) {
    if (!text) continue;
    for (const [pattern, key] of RULES) {
      if (pattern.test(text)) return key;
    }
  }
  return FOOD_ICON_FALLBACK;
}

/** Every icon key the rules can return (for asset-coverage tests). */
export const FOOD_ICON_RULE_KEYS: readonly FoodIconKey[] = [
  ...new Set([...RULES.map(([, key]) => key), FOOD_ICON_FALLBACK]),
];
