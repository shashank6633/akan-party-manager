/**
 * AKAN Corporate Packages — Full Menu, Package Definitions, Addons, Drinks
 * Source: Akan-Corporate-Packages-v6.pdf
 */

// ---------------------------------------------------------------------------
// FULL FOOD MENU — Items available across ALL packages
// Users pick "ANY X" from each category based on package limits
// ---------------------------------------------------------------------------

export const FULL_MENU = {
  vegStarters: {
    label: 'Veg Starters',
    subcategories: {
      Continental: [
        'Chilly Garlic Potato Wedges',
        'Veg Cheese Croquette',
        'Corn Jalapeno Poppers',
        'Beetroot Cilantro Falafel',
        'Paneer PopCorn',
      ],
      Indian: [
        'Tandoori Paneer Tikka',
        'Green Peas Hara Bara Kebab',
        'Corn Bell Pepper Tikki',
        'Banjara Paneer Tikka',
        'Achari Gobi Tikka',
      ],
      Asian: [
        'Stir Fry Crispy Veg',
        'Baby Corn Salt & Pepper',
        'Chilli Garlic Potato Wedges',
        'Gobi 65',
        'Paneer Chilly Dry',
      ],
    },
  },
  nonVegStarters: {
    label: 'Non-Veg Starters',
    subcategories: {
      Continental: [
        'Chicken Moroccan Spiced Popcorn',
        'Panko Kasundi Fish Fingers',
        'Smoked BBQ Chicken Wings',
        'Cajun Spiced Chicken',
        'Mexican Fish',
      ],
      Indian: [
        'Tandoori Murgh Tikka',
        'Koliwada Fish',
        'Guntur Karam Kodi Roast',
        'Ajwaini Fish Tikka',
        'Achari Murgh Tikka',
      ],
      Asian: [
        'Hunan Chicken',
        'Pepper Chicken',
        'Schezwan Chicken Wings',
        'Chicken 65',
        'Chilly Chicken Dry',
      ],
    },
  },
  vegMainCourse: {
    label: 'Veg Main Course',
    subcategories: {
      Continental: [
        'Vegetable Alfredo Pasta',
        'Veg Arrabbiata Pasta',
        'Madras Curry Pasta Veg',
        'Veg Pink Sauce Pasta',
        'Coriander & Garlic Pesto Pasta',
      ],
      Indian: [
        'Kadai Subzi',
        'Paneer Butter Masala',
        'Subzi Kolhapuri',
        'Nizami Handi',
        'Paneer Lababdar',
        'Veg Biryani',
        'Veg Tehri Pulao',
      ],
      Asian: [
        'Hot Garlic Paneer',
        'Veg Manchurian',
        'Schezwan Vegetables Gravy',
        'Veg Fried Rice',
        'Burnt Garlic Fried Rice',
        'Veg Schezwan Rice',
        'Chilly Garlic Rice',
      ],
    },
  },
  nonVegMainCourse: {
    label: 'Non-Veg Main Course',
    subcategories: {
      Continental: [
        'Chicken Alfredo Pasta',
        'Chicken Arrabbiata Pasta',
        'Chicken Madras Curry Pasta',
        'Chicken Pink Sauce Pasta',
        'Coriander & Garlic Pesto Pasta (Chicken)',
      ],
      Indian: [
        'Kadai Murgh (With Bone)',
        'Murgh Butter Masala (With Bone)',
        'Chicken Korma (With Bone)',
        'Chicken Tikka Masala (With Bone)',
        'Chicken Do Pyaza (With Bone)',
        'Chicken Biryani',
      ],
      Asian: [
        'Fish In Oyster Sauce',
        'Chilly Chicken Gravy',
        'Chicken Schezwan Gravy',
        'Chicken Fried Rice',
        'Chicken Burnt Garlic Fried Rice',
        'Chicken Schezwan Rice',
        'Chicken Chilly Garlic Rice',
      ],
    },
  },
  rice: {
    label: 'Fried / Flavoured Rice',
    items: ['Bagara Rice', 'Jeera Rice', 'Veg Fried Rice', 'Egg Fried Rice'],
  },
  dal: {
    label: 'Dal',
    items: ['Dal Tadka', 'Tomato Dal', 'Palak Dal', 'Rajma Masala'],
  },
  salad: {
    label: 'Salad',
    items: ['Papdi Chat Salad', 'Veg Green Salad', 'Russian Salad', 'Mexican Beans Salad'],
  },
  accompaniments: {
    label: 'Accompaniments',
    items: ['Assorted Indian Breads', 'Mirchi Ka Salan', 'Raita', 'Steam Rice', 'Plain Curd'],
  },
  desserts: {
    label: 'Desserts',
    items: [
      'Brownie With Ice Cream',
      'Mango White Chocolate & Sago Pudding',
      'Gulab Jamun',
      'Double Ka Meetha',
      'Honey Noodle With Ice Cream',
      'Baked Bread Butter Pudding',
    ],
  },
};

// ---------------------------------------------------------------------------
// PACKAGES — Name, price, item limits per category, drinks
// ---------------------------------------------------------------------------

export const PACKAGES = {
  'Platinum FL': {
    label: 'Platinum FL',
    price: '₹5999++ Tax',
    serving: '3 Hrs',
    limits: {
      vegStarters: 3,
      nonVegStarters: 3,
      vegMainCourse: 2,
      nonVegMainCourse: 2,
      rice: 1,
      dal: 1,
      salad: 1,
      accompaniments: 5,
      desserts: 2,
    },
    drinks: [
      'Godawan Single Malt',
      'Chivas Regal 12yrs',
      'The Glenlivet 12yrs',
      'Bacardi White Rum',
      'Bombay Sapphire',
      'Grey Goose Vodka',
      'Belvedere Vodka',
      'Kingfisher Ultra',
      'Heineken',
      'Budweiser',
      'Corona',
      'J.C Red Wine',
      'J.C White Wine',
      'A.G White Wine',
      'A.G Red Wine',
      'Dark Rum',
    ],
    cocktails: '3 Cocktails',
    mocktails: '3 Mocktails',
    softDrinks: 'Aerated Drinks',
  },
  'Gold FL': {
    label: 'Gold FL',
    price: '₹3999++ Tax',
    serving: '2.5 Hrs',
    limits: {
      vegStarters: 3,
      nonVegStarters: 3,
      vegMainCourse: 2,
      nonVegMainCourse: 2,
      rice: 1,
      dal: 1,
      salad: 1,
      accompaniments: 5,
      desserts: 2,
    },
    drinks: [
      'J.W Black Label',
      'Chivas Regal 12yrs',
      'Bacardi White Rum',
      'Absolut Vodka',
      'Ketel One Vodka',
      'Bombay Sapphire',
      'Kingfisher Ultra',
      'Heineken',
      'Budweiser',
      'Budweiser Draught',
      'Kingfisher Draught',
      'J.C Red Wine',
      'J.C White Wine',
      'A.G White Wine',
      'A.G Red Wine',
      'Dark Rum',
    ],
    cocktails: '3 Cocktails',
    mocktails: '3 Mocktails',
    softDrinks: 'Aerated Drinks',
  },
  'Silver FL': {
    label: 'Silver FL',
    price: '₹2999++ Tax',
    serving: '2.5 Hrs',
    limits: {
      vegStarters: 3,
      nonVegStarters: 3,
      vegMainCourse: 2,
      nonVegMainCourse: 2,
      rice: 1,
      dal: 1,
      salad: 1,
      accompaniments: 5,
      desserts: 2,
    },
    drinks: [
      'Ballantines Finest',
      'Bushmills Original',
      'Red Label',
      'Jameson',
      'Ketel One Vodka',
      'Absolut Vodka',
      'Beefeater Gin',
      'Kingfisher Ultra',
      'Heineken',
      'Kingfisher Draught',
      'Budweiser Draught',
      'Bacardi White Rum',
      'Dark Rum',
      'A.G White Wine',
      'A.G Red Wine',
      'J.C Red Wine',
      'J.C White Wine',
    ],
    cocktails: '3 Cocktails',
    mocktails: '3 Mocktails',
    softDrinks: 'Aerated Drinks',
  },
  'IMFL Regular': {
    label: 'IMFL Regular',
    price: '₹2499++ Tax',
    serving: '2.5 Hrs',
    limits: {
      vegStarters: 3,
      nonVegStarters: 3,
      vegMainCourse: 2,
      nonVegMainCourse: 2,
      rice: 1,
      dal: 1,
      salad: 1,
      accompaniments: 5,
      desserts: 2,
    },
    drinks: [
      'Black Dog',
      '100 Pipers',
      'Smirnoff Vodka',
      'Greater Than Gin',
      'SULA White Wine',
      'SULA Red Wine',
      'Kingfisher Premium',
      'Budweiser Draught',
      'Kingfisher Draught',
      'Bacardi White Rum',
      'Dark Rum',
    ],
    cocktails: '3 Barman Special Cocktails',
    mocktails: '3 Barman Special Mocktails',
    softDrinks: 'Aerated Drinks',
  },
  'Beer & Wine': {
    label: 'Beer & Wine',
    price: '₹2199++ Tax',
    serving: '2 Hrs',
    limits: {
      vegStarters: 3,
      nonVegStarters: 3,
      vegMainCourse: 2,
      nonVegMainCourse: 2,
      rice: 1,
      dal: 1,
      salad: 1,
      accompaniments: 5,
      desserts: 2,
    },
    drinks: [
      'Kingfisher Premium',
      'Budweiser Draught',
      'Kingfisher Draught',
      'SULA (Red & White Wine)',
    ],
    cocktails: null,
    mocktails: '3 Barman Special Mocktails',
    softDrinks: 'Aerated Drinks',
  },
  'Food & Beer': {
    label: 'Food & Beer',
    price: '₹1999++ Tax',
    serving: '2 Hrs',
    limits: {
      vegStarters: 3,
      nonVegStarters: 3,
      vegMainCourse: 2,
      nonVegMainCourse: 2,
      rice: 1,
      dal: 1,
      salad: 1,
      accompaniments: 5,
      desserts: 2,
    },
    drinks: [
      'Kingfisher Premium',
      'Budweiser Draught',
      'Kingfisher Draught',
    ],
    cocktails: null,
    mocktails: '3 Mocktails',
    softDrinks: 'Aerated Drinks',
  },
  'Food Only (Veg + Non-Veg)': {
    label: 'Food Only (Veg + Non-Veg)',
    price: '₹1599++ Tax',
    serving: '90 Mins',
    limits: {
      vegStarters: 3,
      nonVegStarters: 3,
      vegMainCourse: 2,
      nonVegMainCourse: 2,
      rice: 1,
      dal: 1,
      salad: 1,
      accompaniments: 5,
      desserts: 2,
    },
    drinks: [],
    cocktails: null,
    mocktails: '3 Barman Special Mocktails',
    softDrinks: 'Aerated Drinks',
  },
  'Food Only (Veg)': {
    label: 'Food Only (Veg)',
    price: '₹1199++ Tax',
    serving: '90 Mins',
    limits: {
      vegStarters: 3,
      nonVegStarters: 0,
      vegMainCourse: 2,
      nonVegMainCourse: 0,
      rice: 1,
      dal: 1,
      salad: 1,
      accompaniments: 5,
      desserts: 2,
    },
    drinks: [],
    cocktails: null,
    mocktails: '3 Barman Special Mocktails',
    softDrinks: 'Aerated Drinks',
  },
};

// ---------------------------------------------------------------------------
// ADDONS — Extra items at additional per-person cost
// ---------------------------------------------------------------------------

export const ADDONS = {
  mutton: {
    label: 'Mutton Addons',
    pricePerHead: 250,
    starters: [
      'Lamb Seekh Kebab',
      'Lamb Shami Kebab',
      'Mutton Chettinad',
      'Mutton Gongura',
    ],
    mainCourse: [
      'Kadai Gosht',
      'Rara Gosht',
      'Palak Gosht',
      'Mutton Rogan Josh',
      'Mutton Kheema',
    ],
  },
  prawns: {
    label: 'Prawns Addons',
    pricePerHead: 300,
    starters: [
      'Butter Garlic Prawns',
      'Basil Prawns',
      'Prawns Bhaticharu',
      'Thai Chilli Basil Prawns',
    ],
    mainCourse: [
      'Royyala Iguru',
      'Prawns Malvani',
      'Goan Prawns Curry',
      'Thai Prawns Curry',
    ],
  },
  extras: {
    label: 'Extra Addons (Per Person)',
    items: [
      { name: 'Extra Veg Starter', price: 125 },
      { name: 'Extra Chicken Starter', price: 150 },
      { name: 'Live Chat Counter', price: 125 },
      { name: 'Live Pasta Counter', price: 150 },
      { name: 'Live Tawa Fried Fish', price: 200 },
      { name: 'Live Mexican Wraps (Burritos, Enchiladas, Chimichangas)', price: 200 },
      { name: 'Extra Dessert', price: 200 },
    ],
  },
};

// ---------------------------------------------------------------------------
// DISCLAIMERS
// ---------------------------------------------------------------------------

export const DISCLAIMERS = [
  'Not included in the package: Breezer, Shots, Redbull, Ginger Ale & Tonic Water.',
  'Outside Food and Drinks are not allowed.',
  'Alcohol is not served to individuals under the age of 21.',
  'Live Counters for Addons are available for groups ranging from 50-300 Pax.',
  'A Minimum Guarantee of 30 Pax is required for Party Bookings.',
  'Addon prices are per person.',
  'Drinks are subject to availability.',
  '*Terms & Conditions Apply.',
];

// ---------------------------------------------------------------------------
// MENU CATEGORY KEYS (for iteration)
// ---------------------------------------------------------------------------

export const MENU_CATEGORIES = [
  'vegStarters',
  'nonVegStarters',
  'vegMainCourse',
  'nonVegMainCourse',
  'rice',
  'dal',
  'salad',
  'accompaniments',
  'desserts',
];

/**
 * Get all items flat for a given category.
 * For categories with subcategories, flattens them.
 */
export function getAllItemsForCategory(categoryKey) {
  const cat = FULL_MENU[categoryKey];
  if (!cat) return [];
  if (cat.items) return cat.items;
  if (cat.subcategories) {
    return Object.entries(cat.subcategories).flatMap(([sub, items]) =>
      items.map((item) => ({ item, subcategory: sub }))
    );
  }
  return [];
}
