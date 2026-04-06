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
        'Mushroom and Cheese Arancini',
        'Beetroot and Menthulu Falafel',
        'Corn Jalapeno Mozzarella Balls',
        'Veg Croquette',
        'Peri Peri Paneer Popcorn',
        'Paneer Nuggets',
      ],
      Indian: [
        'Achari Paneer Tikka',
        'Peri Peri Gobi Tikka',
        'Thecha Cauliflower Tikka',
        'Pubbas Beetroot Cutlet',
        'Honey Siracha Paneer',
        'Hara Bhara Cashew Kebab',
        'Veg Shikampuri Kebab',
      ],
      Asian: [
        'Pepper Chilli Potato Wedges',
        'Crispy Thai Chilli Vegetables',
        'Crispy Babycorn and Mushroom in Hot Garlic Sauce',
        'Stirfry Soy Chilli Garlic Paneer',
        'Chilli Paneer',
        'Kolkata Style Gobi Manchurian',
        'Veg Spring Roll',
      ],
    },
  },
  nonVegStarters: {
    label: 'Non-Veg Starters',
    subcategories: {
      Continental: [
        'Gun Powder Chicken Popcorn',
        'Morrocan Chicken Nuggets',
        'Mexican Fish',
        'Panko Peri Peri Fish Fingers',
      ],
      Indian: [
        'Bhatti ka Murgh',
        'Fiery Angara Murgh',
        'Curryleaf Chicken Tikka',
        'Chicken Shish Taouk',
        'Thecha Chicken Tikka',
        'Telangana Style Chicken 65',
        'Chicken Majestic',
        'Achari Fish Tikka (Grilled)',
        'Guntur Karam Kodi Roast',
        'Amritsari Ajwaini Fish (Deep Fried)',
        'Telangana Fish Tikka (Grilled)',
      ],
      Asian: [
        'Apollo Fish Fry',
        'Thai Fish Fingers',
        'Schezwan Glazed Chicken Wings',
        'Siracha Honey Glazed Chicken Wings',
      ],
    },
  },
  vegMainCourse: {
    label: 'Veg Main Course',
    subcategories: {
      Continental: [
        'Mushroom Stroganoff',
        'Veg Alfredo Pasta',
        'Coriander Pesto Veg Pasta',
        'Pink Sauce Vodka Veg Pasta',
        'Veg Au\'Gratin',
        'Hungarian Mushroom Goulash',
        'Irish Veg Stew',
      ],
      Indian: [
        'Paneer Makhanwala',
        'Ludhiana Style Paneer Saagwala',
        'Veg Do Pyaza',
        'Veg Jalfrezi',
        'Methi Chaman',
        'Veg Kolhapuri',
      ],
      Asian: [
        'Oriental Veg in Hot Garlic Sauce',
        'Oriental Veg in Black Bean Sauce',
        'Oriental Veg in Hot & Sweet Sauce',
        'Veg Thai Green Curry',
        'Veg Thai Red Curry',
        'Malaysian Veg Laksa',
      ],
    },
  },
  nonVegMainCourse: {
    label: 'Non-Veg Main Course',
    subcategories: {
      Continental: [
        'Chicken Stroganoff',
        'Chicken Alfredo Pasta',
        'Coriander Pesto Chicken Pasta',
        'Pink Sauce Vodka Pasta Chicken',
        'Chicken in Coq au Vin Sauce',
        'Hungarian Chicken Goulash',
        'Irish Chicken Stew',
      ],
      Indian: [
        'Methi Murgh',
        'Achari Murg',
        'Butter Chicken',
        'Dhaba Style Chicken Curry',
        'Manglorean Fish Curry',
        'Goan Fish Curry',
        'Chicken Do Pyaza',
      ],
      Asian: [
        'Fish in Oyster Sauce',
        'Chicken in Black Bean Sauce',
        'Chicken in Hot Basil Sauce',
        'Chicken Thai Green Curry',
        'Chicken Malaysian Laksa',
        'Chicken Thai Red Curry',
      ],
    },
  },
  rice: {
    label: 'Flavoured / Fried Rice',
    items: ['Bagara Rice', 'Jeera Rice', 'Veg Fried Rice', 'Egg Fried Rice'],
  },
  dal: {
    label: 'Dal',
    items: ['Dal Tadka', 'Tomato Dal', 'Palak Dal', 'Kadhu Ka Dalcha', 'Rajma Masala'],
  },
  salad: {
    label: 'Salad',
    items: ['Green Salad', 'Mexican Bean Salad', 'Russian Salad', 'Papdi Chaat', 'Pineapple Raita', 'Boondi Raita'],
  },
  accompaniments: {
    label: 'Accompaniments',
    items: ['Assorted Indian Breads', 'Mirchi Ka Salan', 'Raita', 'Steam Rice', 'Plain Curd'],
  },
  desserts: {
    label: 'Desserts',
    items: [
      'Mango Sago Pudding',
      'Fudgy Chocolate Brownie',
      'Espresso Coffee Phirnee',
      'Thandai Risotto Pudding',
      'Mixed Fruit Cheese Cake',
      'Assorted Mini Pastries',
      'Gulab Jamun',
      'Semiya Payasam (hot)',
      'Jalebi with Rabdi (hot)',
      'Double Ka Meetha',
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
    starterPrice: 250,
    mainCoursePrice: 300,
    starters: [
      'Mutton Shikampuri Tikka',
      'Mutton Shammi Kebab',
      'Chilli Lamb Wontons',
      'Mutton Chettinad Roast (with bone)',
      'Mutton Kheema Arancini',
    ],
    mainCourse: [
      'Hungarian Mutton Goulash',
      'Kolkata Railway Mutton Curry',
      'Mutton Rogan Josh',
      'Mutton Chettinad',
      'Mutton Maratha',
    ],
  },
  prawns: {
    label: 'Prawns Addons',
    pricePerHead: 250,
    starterPrice: 250,
    mainCoursePrice: 300,
    starters: [
      'Crispy Garlic Shrimp Pakoda',
      'Burnt Garlic n Chilli Stir Fried Prawns',
      'Prawns in Black Bean Sauce',
      'Royalla Iguru',
      'Royalla Vepudu',
      'Karampodi Shrimp Popcorn',
    ],
    mainCourse: [
      'Prawns Chettinad Curry',
      'Kasundi Prawns Curry',
      'Prawns in Oyster Sauce',
      'Manglorean Prawns Curry',
      'Goan Prawns Curry',
      'Thai Prawns Curry',
    ],
  },
  extras: {
    label: 'Extra Addons (Per Person)',
    items: [
      { name: 'Extra Veg Starter', price: 125 },
      { name: 'Extra Chicken Starter', price: 150 },
      { name: 'Live Chaat Counter', price: 125 },
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
