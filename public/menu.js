/* =========================================================
   menu.js — clickable rows + modal
   ========================================================= */

const MENU_IMAGES = {
  'sticky-rice':      'Pictures/menu/current/srpt.JPG',
  'milk-tea':         'Pictures/menu/current/mt.png',
  'yuja-ade':         'Pictures/menu/current/yj.png',
  'matcha-latte':     'Pictures/menu/current/aml.JPG',
  'strawberry-fizz':  'Pictures/menu/current/strawberry-fizz.jpg',
  'matcha-cortdo':    'Pictures/menu/current/aml.JPG',
  'matcha-tea':       'Pictures/menu/current/aml.JPG',
  'matcha-ade':       'Pictures/menu/current/aml.JPG',
  /*ARCHIVE*/
// Archive — Main
'lychee-black-tea':       'Pictures/menu/archive/lychee-black-tea.jpg',
'hojicha-latte':          'Pictures/menu/archive/hojicha-latte.jpg',
'rooibos-tea':            'Pictures/menu/archive/rooibos-tea.jpg',
'bittersweet-kiss':       'Pictures/menu/archive/bittersweet-kiss.jpg',
'sweet-dreams':           'Pictures/menu/archive/sweet-dreams.jpg',
'campfires-marshmallows': 'Pictures/menu/archive/campfires-marshmallows.jpg',
'coffee':                 'Pictures/menu/archive/coffee.jpg',
'campfires-2':            'Pictures/menu/archive/campfires-2.jpg',
// Archive — Ikebana Alcohol Night
'chuhai':                 'Pictures/menu/archive/ikebana/chuhai.jpg',
'matcha-martini':         'Pictures/menu/archive/ikebana/matcha-martini.jpg',
'jasmine-cocktail':       'Pictures/menu/archive/ikebana/jasmine-cocktail.jpg',
// Archive — Miscellaneous
'lychee-aloe-martini':    'Pictures/menu/archive/misc/lychee-aloe-martini.png',
'na-margarita':           'Pictures/menu/archive/misc/na-margarita.png',
'coffee-bourbon-soy':     'Pictures/menu/archive/misc/coffee-bourbon-soy.png',
'grapefruit-curacao':     'Pictures/menu/archive/misc/grapefruit-curacao.png',
'yuja-schisandra':        'Pictures/menu/archive/misc/yuja-schisandra.png',
'perilla-jeju':           'Pictures/menu/archive/misc/perilla-jeju.png',
'clarified-coffee':       'Pictures/menu/archive/misc/clarified-coffee.png',
'matcha-jasmine-cream':   'Pictures/menu/archive/misc/matcha-jasmine-cream.png',
'orange-chai':            'Pictures/menu/archive/misc/orange-chai.png',
'shaken-jasmine-jeju':    'Pictures/menu/archive/misc/shaken-jasmine-jeju.png',
'misugaru-mocha':         'Pictures/menu/archive/misc/misugaru-mocha.png', 
};

const MENU_DATA = {
  'sticky-rice':      { num:'#01', cat:'Special',          name:'"Sticky Rice" Pureh Tea',         ingredients:['2019 Puerh Tea','Oat Milk','Brown Sugar', 'Mango Stick'],                                             profile:{Silky:4,Malty:5,Sweet:4},      note:'Earthy puerh layered with toasted rice warmth and creamy oat texture. The mango stick softens the finish with a subtle tropical sweetness.' },
  'milk-tea':         { num:'#02', cat:'Special',          name:'Milk Tea - Red Tea',              ingredients:['Jin Hao Red Tea','Brown Sugar','Salted Vanilla Cream', 'Nutmeg'],                                     profile:{Nutty:3,Chocolate:4,Creamy:4}, note:'Deep red tea balanced with brown sugar and a salted vanilla cream top. Smooth, rich, and comforting with a warm spice finish.' },
  'yuja-ade':         { num:'#03', cat:'Special',          name:'Yuja Ade',                        ingredients:['Yuzu and Honey Marmalade','Calamansi','Sparkling', 'Mint'],                                           profile:{Citrus:5,Sweet:4,Light:5},     note:'Bright yuzu and calamansi lifted with sparkling citrus and cooling mint. Sweet, sharp, and refreshing from the first sip.' },
  'matcha-latte':     { num:'#04', cat:'Special',          name:'Matcha Latte',                    ingredients:['Uji Sourced Matcha','Minor Figures Oat Milk','Brown Sugar'],                                          profile:{Velvety:4,Smoth:4,Rich:5},     note:'Stone-ground Uji matcha whisked smooth with oat milk and brown sugar. Rich, creamy, and balanced with a clean grassy finish.' },
  'strawberry-fizz':  { num:'#05', cat:'Seasonal',         name:'Strawberry Fizz',                 ingredients:['42 HR Strawberry Syrup','Calamansi','Sparkling Yuzu and Calamansi Foam', 'Macerated Strawberries'],   profile:{Fruity:4,Bright:5,Sweet:3},    note:'House strawberry syrup shaken with calamansi and topped with sparkling citrus foam. Fruity, fizzy, and made for warm afternoons.' },
  'matcha-cortdo':    { num:'#06', cat:'Matcha',           name:'Matcha Cortdo',                   ingredients:['Uji Sourced Matcha'],                                                                                 profile:{Delicate:5,Smooth:4,Sweet:3},   note:'A concentrated matcha drink with bold roasted depth and a velvety body. Small, smooth, and quietly intense.' },
  'matcha-tea':       { num:'#07', cat:'Matcha',           name:'Matcha Tea',                      ingredients:['Uji Sourced Matcha'],                                                                                 profile:{Classic:5,Sweet:4,Light:5},    note:'Pure ceremonial-grade matcha prepared traditionally. Clean vegetal notes with a naturally sweet and lingering finish.' },
  'matcha-ade':       { num:'#08', cat:'Matcha',           name:'Matcha Calamansi Ade',            ingredients:['Uji Sourced Matcha','Calamansi'],                                                                     profile:{Bold:4,Sweet:4,Crisp:5},    note:'Bright calamansi citrus layered beneath smooth Uji matcha. Refreshing, vibrant, and slightly sweet with a crisp finish.' },
  /*ARCHIVE*/
// Archive — Main
'lychee-black-tea':       { num:'#A1', cat:'Archive', name:'Lychee "Infused" Black Tea',        ingredients:['Real Lychee Fruit (Smoked & Infused)','Congou Black Tea'],                                              profile:{Fruity:5,Sweet:4,Floral:4},      note:'Real lychee fruit smoked and infused directly into the congou black tea, naturally sweetening and flavoring the leaves with a delicate fruity note.' },
'hojicha-latte':          { num:'#A2', cat:'Archive', name:'Hojicha Latte',                     ingredients:['Shirawake Uji Hojicha','Oat Milk','Brown Sugar'],                                                       profile:{Roasted:5,Nutty:4,Chocolatey:4}, note:'A roasted hojicha from Shirawake, Uji — the chocolatey, nutty, and woody counterpart to our beloved matcha lattes.' },
'rooibos-tea':            { num:'#A3', cat:'Archive', name:'Rooibos Tea',                       ingredients:['African Rooibos'],                                                                                      profile:{Earthy:4,Nutty:3,Citrus:3},      note:'A caffeine-free African tea with refreshing, nutty, and earthy tones. Notes of citrus, sage, and honey.' },
'bittersweet-kiss':       { num:'#A4', cat:'Archive', name:'Bittersweet Kiss',                  ingredients:['Rooibos Concentrate','Orange Oil','Lemon','Aperitif','Zero Proof Gin'],                                 profile:{Bitter:4,Citrus:4,Complex:5},    note:"AKO's first non-alcoholic mocktail — a play on a feeling. A rooibos base with orange oil, lemon, aperitif, and zero proof gin." },
'sweet-dreams':           { num:'#A5', cat:'Archive', name:'Sweet Dreams',                      ingredients:['Roasted Tie Guan Yin Concentrate','Brown Sugar','Vanilla','Sparkling Water'],                           profile:{Roasty:4,Nutty:4,Sweet:4},       note:'An oolong cream soda. A carbonated tea highball with roasty and nutty notes from a Tie Guan Yin concentrate, brown sugar, and vanilla.' },
'campfires-marshmallows': { num:'#A6', cat:'Archive', name:'Campfires and Marshmallows',        ingredients:['Smoked Black Tea','Wuyi Oolong Infused Cream','Toffee Crumble'],                                        profile:{Smoky:5,Sweet:4,Woody:4},        note:'A smoked black tea base with a wuyi oolong cream top and toffee crumble. Evokes an open fire and pine wood with marshmallows roasting over the flame.' },
'coffee':                 { num:'#A7', cat:'Archive', name:'"Coffee"',                          ingredients:['Bori-cha (Barley Tea)','Hyeonmi-cha (Brown Rice Tea)'],                                                 profile:{Roasted:5,Nutty:4,Familiar:5},   note:'A Korean-inspired blend of bori-cha and hyeonmi-cha prepared like a pour-over. All the iconic coffee taste and aroma — zero caffeine.' },
'campfires-2':            { num:'#A8', cat:'Archive', name:'Campfires 2.0',                     ingredients:['Lapsang Souchong','Wuyi Oolong Foam','Toffee Crumble'],                                                 profile:{Smoky:4,Calming:5,Sweet:3},      note:'An evolved take on Campfires and Marshmallows. Swapping the cream top for an oolong foam transforms it from heavy and smoky-sweet to quietly sitting by the fireplace.' },

// Archive — Ikebana Alcohol Night 2025
'chuhai':                 { num:'#B1', cat:'Ikebana — Alcohol Night 2025', name:'Chuhai',                ingredients:['Oolong Infused Barley Shochu','Club Soda'],                                                      profile:{Light:4,Crisp:5,Roasted:3},      note:'An adaptation of an oolong hai. Oolong-infused barley shochu topped with club soda — simple, refreshing, and quietly complex.' },
'matcha-martini':         { num:'#B2', cat:'Ikebana — Alcohol Night 2025', name:'Matcha',                ingredients:['Uji Matcha','Licor 43','Haku Vodka','Cream','Egg Whites'],                                        profile:{Rich:5,Decadent:5,Sweet:4},      note:"AKO's take on a matcha martini with a touch of chocolate. Matcha, Licor 43, Haku vodka, cream, and egg whites — decadent and rich." },
'jasmine-cocktail':       { num:'#B3', cat:'Ikebana — Alcohol Night 2025', name:'Jasmine',               ingredients:['Jasmine Milk Tea','Roku Gin','Lychee','Fresh Lemon Juice'],                                       profile:{Floral:5,Silky:5,Citrus:3},      note:'A clarified cocktail that captures the silky feeling of a milk tea with a jasmine green tea aroma. Playing off a classic, nostalgic milk tea.' },

// Archive — Miscellaneous
'lychee-aloe-martini':    { num:'#C1',  cat:'Miscellaneous', name:'Lychee Aloe N/A Martini',              ingredients:['Lychee','Aloe'],                                             profile:{Floral:4,Light:4,Sweet:4},    note:'' },
'na-margarita':           { num:'#C2',  cat:'Miscellaneous', name:'N/A Margarita',                        ingredients:[],                                                           profile:{Citrus:5,Tart:4,Crisp:4},     note:'' },
'coffee-bourbon-soy':     { num:'#C3',  cat:'Miscellaneous', name:'Coffee & N/A Bourbon with Soy Foam',   ingredients:['Coffee','N/A Bourbon','Soy Sauce Foam'],                    profile:{Bold:5,Umami:4,Roasted:4},    note:'' },
'grapefruit-curacao':     { num:'#C4',  cat:'Miscellaneous', name:'Grapefruit & Blue Curaçao Spritz',     ingredients:['Grapefruit','Blue Curaçao'],                                profile:{Citrus:5,Bright:4,Fizzy:4},   note:'' },
'yuja-schisandra':        { num:'#C5',  cat:'Miscellaneous', name:'Yuja & Schisandra Berry Tonic',        ingredients:['Yuzu','Schisandra Berry','Tonic'],                          profile:{Tart:4,Floral:4,Complex:5},   note:'' },
'perilla-jeju':           { num:'#C6',  cat:'Miscellaneous', name:'Shaken Perilla Leaf Jeju Green Tea',   ingredients:['Perilla Leaf','Jeju Green Tea'],                            profile:{Herbal:5,Fresh:4,Light:4},    note:'' },
'clarified-coffee':       { num:'#C7',  cat:'Miscellaneous', name:'Clarified Coffee',                     ingredients:['Clarified Coffee','Rose','Nutmeg Cream'],                  profile:{Roasted:5,Floral:3,Creamy:4}, note:'' },
'matcha-jasmine-cream':   { num:'#C8',  cat:'Miscellaneous', name:'Matcha & Jasmine Cream Top',           ingredients:['Matcha','Jasmine Infused Cream'],                           profile:{Floral:5,Smooth:4,Sweet:3},   note:'' },
'orange-chai':            { num:'#C9',  cat:'Miscellaneous', name:'Brown Sugar & Orange Spiced Chai',     ingredients:['Chai','Brown Sugar','Orange'],                              profile:{Spiced:5,Sweet:4,Warm:5},     note:'' },
'shaken-jasmine-jeju':    { num:'#C10', cat:'Miscellaneous', name:'Shaken Jasmine Jeju Green Tea',        ingredients:['Jasmine','Jeju Green Tea'],                                 profile:{Floral:5,Light:4,Crisp:4},    note:'' },
'misugaru-mocha':         { num:'#C11', cat:'Miscellaneous', name:'Smoked Misugaru Mocha',                ingredients:['Misugaru','Smoked Base','Mocha'],                           profile:{Smoky:4,Nutty:5,Rich:4},      note:'' },         
};

// Paste your archived drinks here later.
// Expected shape:
// [{ id, name, desc, image, category, ingredients, profile, note }]
const ARCHIVE_MENU_ITEMS = [
  {
    id: 'archive-lychee-infused-black-tea',
    name: 'Lychee Infused Black Tea',
    desc: 'Real lychee fruit smoked and infused into congou black tea with a fruity note.',
    image: 'Pictures/menu/current/libt.JPG',
    category: 'Current Menu (Legacy)',
    ingredients: ['Congou Black Tea', 'Smoked Lychee Fruit'],
    profile: { Fruity: 5, Sweet: 3, Bold: 3 },
    note: 'A legacy version from early AKO menu development.',
  },
  {
    id: 'archive-hojicha-latte-2025',
    name: "AKO's Hojicha Latte",
    desc: 'Roasted matcha from Shirakawa, Uji. Chocolatey, nutty, and woody.',
    image: 'Pictures/menu/fall.wint/ahl.JPG',
    category: 'Seasonal Fall/Winter Menu 2025',
    ingredients: ['Hojicha', 'Milk', 'Sweetener'],
    profile: { Nutty: 4, Roasty: 5, Smooth: 4 },
    note: 'Seasonal roasted tea latte from the 2025 cold-season set.',
  },
  {
    id: 'archive-chuhai',
    name: 'Chuhai',
    desc: 'An adaptation of an oolong hai with oolong-infused barley shochu and club soda.',
    image: 'Pictures/menu/ikebana/CHUHAI.JPG',
    category: 'Ikebana Alc Night Menu 2025',
    ingredients: ['Oolong-Infused Barley Shochu', 'Club Soda'],
    profile: { Crisp: 4, Dry: 4, Herbal: 3 },
    note: 'Tea-inspired cocktail expression from AKO night service.',
  },
  {
    id: 'archive-matcha-cocktail',
    name: 'Matcha',
    desc: "AKO's matcha martini with chocolate notes.",
    image: 'Pictures/menu/ikebana/MATCHA.JPG',
    category: 'Ikebana Alc Night Menu 2025',
    ingredients: ['Matcha', 'Licor 43', 'Haku Vodka', 'Cream', 'Egg Whites'],
    profile: { Rich: 5, Creamy: 4, Sweet: 3 },
    note: 'Decadent tea cocktail with dessert-like depth.',
  },
  {
    id: 'archive-jasmine-cocktail',
    name: 'Jasmine',
    desc: 'Clarified jasmine milk tea cocktail with lychee, gin, and fresh lemon.',
    image: 'Pictures/menu/ikebana/JASMINE.JPG',
    category: 'Ikebana Alc Night Menu 2025',
    ingredients: ['Jasmine Milk Tea', 'Roku Gin', 'Lychee', 'Fresh Lemon Juice'],
    profile: { Floral: 5, Silky: 4, Bright: 4 },
    note: 'Nostalgic milk tea profile adapted into a clarified cocktail.',
  },
  {
    id: 'archive-cream-2',
    name: 'Cream',
    desc: 'A 2.0 version with a more bubbly, creamy, and oolong-forward profile.',
    image: 'Pictures/menu/ikebana/CREAM.JPG',
    category: 'Ikebana Non Alc Night Menu 2025',
    ingredients: ['Oolong Base', 'Cream Top', 'Carbonation'],
    profile: { Creamy: 4, Bubbly: 4, Oolong: 4 },
    note: 'Updated non-alcoholic concept from the Ikebana set.',
  },
  {
    id: 'archive-lychee-zero-martini',
    name: 'Lychee',
    desc: 'A zero lychee martini with botanical, floral, and sweet notes.',
    image: 'Pictures/menu/ikebana/LYCHEE.jpg',
    category: 'Ikebana Non Alc Night Menu 2025',
    ingredients: ['Lychee', 'Botanical Blend'],
    profile: { Floral: 4, Sweet: 4, Light: 4 },
    note: 'Summery zero-proof martini concept.',
  },
  {
    id: 'archive-yuzu-coffee',
    name: 'Yuzu',
    desc: 'Clarified coffee with peach and yuzu and an orange oil spray.',
    image: 'Pictures/menu/ikebana/YUZU.JPG',
    category: 'Ikebana Non Alc Night Menu 2025',
    ingredients: ['Coffee', 'Peach', 'Yuzu', 'Orange Oil'],
    profile: { Juicy: 4, Bright: 4, Deep: 3 },
    note: 'A fruit-forward clarified coffee concept.',
  },
  {
    id: 'archive-lychee-aloe-na-martini',
    name: 'Lychee Aloe N/A Martini',
    desc: 'Experimental non-alcoholic martini style drink.',
    image: 'Pictures/menu/elorea/lanam.png',
    category: 'Miscellaneous Menu 2025',
    ingredients: ['Lychee', 'Aloe'],
    profile: { Floral: 4, Sweet: 3, Light: 4 },
    note: 'Miscellaneous 2025 experiment.',
  },
  {
    id: 'archive-na-margarita',
    name: 'N/A Margarita',
    desc: 'Experimental zero-proof margarita interpretation.',
    image: 'Pictures/menu/elorea/nam.png',
    category: 'Miscellaneous Menu 2025',
    ingredients: ['Citrus Blend', 'Zero-Proof Base'],
    profile: { Tangy: 4, Bright: 4, Crisp: 3 },
    note: 'Miscellaneous 2025 experiment.',
  },
  {
    id: 'archive-coffee-bourbon-soy-foam',
    name: 'Coffee and N/A Bourbon with Soy Sauce Foam',
    desc: 'Coffee-based zero-proof concept topped with soy sauce foam.',
    image: 'Pictures/menu/elorea/cnabwssf.png',
    category: 'Miscellaneous Menu 2025',
    ingredients: ['Coffee', 'N/A Bourbon', 'Soy Sauce Foam'],
    profile: { Savory: 4, Deep: 4, Bold: 4 },
    note: 'Miscellaneous 2025 experiment.',
  },
  {
    id: 'archive-grapefruit-blue-curacao-spritz',
    name: 'Grapefruit and Blue Curacao Spritz',
    desc: 'Citrus-forward sparkling spritz concept.',
    image: 'Pictures/menu/elorea/gfbcs.png',
    category: 'Miscellaneous Menu 2025',
    ingredients: ['Grapefruit', 'Blue Curacao Profile', 'Sparkling Base'],
    profile: { Citrus: 5, Sparkling: 4, Light: 4 },
    note: 'Miscellaneous 2025 experiment.',
  },
  {
    id: 'archive-yuja-schisandra-tonic',
    name: 'Yuja and Schisandra Berry Tonic',
    desc: 'Yuja citrus and berry-tonic concept drink.',
    image: 'Pictures/menu/elorea/ysbt.png',
    category: 'Miscellaneous Menu 2025',
    ingredients: ['Yuja', 'Schisandra Berry', 'Tonic'],
    profile: { Citrus: 4, Tart: 4, Bright: 4 },
    note: 'Miscellaneous 2025 experiment.',
  },
  {
    id: 'archive-perilla-jeju-green-tea',
    name: 'Shaken Perilla Leaf Jeju Green Tea',
    desc: 'Shaken Jeju green tea infused with perilla leaf aromatics.',
    image: 'Pictures/menu/elorea/spljgt.png',
    category: 'Miscellaneous Menu 2025',
    ingredients: ['Jeju Green Tea', 'Perilla Leaf'],
    profile: { Herbal: 5, Fresh: 4, Light: 4 },
    note: 'Miscellaneous 2025 experiment.',
  },
  {
    id: 'archive-clarified-coffee-rose-nutmeg',
    name: 'Clarified Coffee with Rose and Nutmeg Cream',
    desc: 'Clarified coffee with floral rose and warm nutmeg cream.',
    image: 'Pictures/menu/elorea/ccwrnc.png',
    category: 'Miscellaneous Menu 2025',
    ingredients: ['Clarified Coffee', 'Rose', 'Nutmeg Cream'],
    profile: { Floral: 3, Spiced: 4, Deep: 4 },
    note: 'Miscellaneous 2025 experiment.',
  },
  {
    id: 'archive-matcha-jasmine-cream-top',
    name: 'Matcha and Jasmine Infused Cream Top',
    desc: 'Tea-forward drink with matcha and jasmine infused cream top.',
    image: 'Pictures/menu/elorea/mjict.png',
    category: 'Miscellaneous Menu 2025',
    ingredients: ['Matcha', 'Jasmine', 'Cream Top'],
    profile: { Floral: 4, Creamy: 4, Green: 4 },
    note: 'Miscellaneous 2025 experiment.',
  },
  {
    id: 'archive-brown-sugar-orange-spiced-chai',
    name: 'Brown Sugar and Orange Spiced Chai',
    desc: 'Warm chai expression with brown sugar and orange spice notes.',
    image: 'Pictures/menu/elorea/bsosc.png',
    category: 'Miscellaneous Menu 2025',
    ingredients: ['Chai', 'Brown Sugar', 'Orange Spice'],
    profile: { Spiced: 5, Sweet: 4, Warm: 4 },
    note: 'Miscellaneous 2025 experiment.',
  },
  {
    id: 'archive-shaken-jasmine-jeju-green-tea',
    name: 'Shaken Jasmine Jeju Green Tea',
    desc: 'Shaken jasmine and Jeju green tea blend.',
    image: 'Pictures/menu/elorea/sjjgt.png',
    category: 'Miscellaneous Menu 2025',
    ingredients: ['Jasmine', 'Jeju Green Tea'],
    profile: { Floral: 4, Fresh: 4, Light: 4 },
    note: 'Miscellaneous 2025 experiment.',
  },
  {
    id: 'archive-smoked-misugaru-mocha',
    name: 'Smoked Misugaru Mocha',
    desc: 'Smoky grain-forward mocha concept.',
    image: 'Pictures/menu/elorea/smm.png',
    category: 'Miscellaneous Menu 2025',
    ingredients: ['Misugaru', 'Coffee', 'Cocoa'],
    profile: { Roasty: 4, Smoky: 4, Sweet: 3 },
    note: 'Miscellaneous 2025 experiment.',
  },
  {
    id: 'archive-rooibos-tea',
    name: 'Rooibos Tea',
    desc: 'Non-caffeinated African tea with citrus, sage, and honey notes.',
    image: 'Pictures/menu/elorea/r.JPG',
    category: 'Miscellaneous Menu 2025',
    ingredients: ['Rooibos Tea'],
    profile: { Nutty: 3, Earthy: 4, Light: 4 },
    note: 'A non-caffeinated tea with refreshing earthy warmth.',
  },
  {
    id: 'archive-bittersweet-kiss',
    name: 'Bittersweet Kiss',
    desc: "AKO's first non-alcoholic mocktail built on rooibos concentrate.",
    image: 'Pictures/menu/gnw/bsk.JPG',
    category: 'Going Nowhere Menu 2025',
    ingredients: ['Rooibos Concentrate', 'Orange Oil', 'Lemon', 'Aperitif', 'Zero-Proof Gin'],
    profile: { Bitter: 3, Citrus: 4, Complex: 4 },
    note: 'A feeling-driven mocktail from the Going Nowhere set.',
  },
  {
    id: 'archive-sweet-dreams',
    name: 'Sweet Dreams',
    desc: 'An oolong cream soda highball with roasted and nutty notes.',
    image: 'Pictures/menu/gnw/sd.JPG',
    category: 'Going Nowhere Menu 2025',
    ingredients: ['Roasted Tie Guan Yin Concentrate', 'Brown Sugar', 'Vanilla', 'Carbonation'],
    profile: { Nutty: 4, Roasty: 4, Sweet: 3 },
    note: 'A nostalgic tea highball interpretation.',
  },
  {
    id: 'archive-campfires-2',
    name: 'Campfires 2.0',
    desc: 'Lapsang souchong base with oolong foam and toffee crumble garnish.',
    image: 'Pictures/menu/gnw/c2.JPG',
    category: 'Going Nowhere Menu 2025',
    ingredients: ['Lapsang Souchong', 'Oolong Foam', 'Toffee Crumble'],
    profile: { Smoky: 5, Sweet: 3, Calm: 4 },
    note: 'Enhanced rework of the original campfire-inspired drink.',
  },
  {
    id: 'archive-kisses',
    name: 'Kisses',
    desc: 'Strawberry matcha seasonal concept.',
    image: 'Pictures/menu/spring.sum/k.JPG',
    category: 'Seasonal Spring/Summer Menu 2025',
    ingredients: ['Strawberry', 'Matcha'],
    profile: { Fruity: 4, Green: 4, Sweet: 3 },
    note: 'Warm-weather seasonal drink.',
  },
  {
    id: 'archive-campfires-marshmallows',
    name: 'Campfires and Marshmallows',
    desc: 'Smoked black tea with wuyi oolong cream top and toffee crumble.',
    image: 'Pictures/menu/fall.wint/cfmm.JPG',
    category: 'Seasonal Fall/Winter Menu 2024',
    ingredients: ['Smoked Black Tea', 'Wuyi Oolong Cream Top', 'Toffee Crumble'],
    profile: { Smoky: 5, Sweet: 3, Rich: 4 },
    note: 'A nostalgic open-fire inspired winter drink.',
  },
  {
    id: 'archive-coffee-no-caffeine',
    name: 'Coffee',
    desc: 'Bori-cha and hyeonmi-cha prepared like pour over coffee with no caffeine.',
    image: 'Pictures/menu/fall.wint/ahl.JPG',
    category: 'Seasonal Fall/Winter Menu 2024',
    ingredients: ['Bori-cha', 'Hyeonmi-cha'],
    profile: { Roasty: 4, Toasty: 4, Smooth: 3 },
    note: 'Coffee-like aroma and structure without caffeine.',
  },
];

function buildDots(level, max = 5) {
  return Array.from({ length: max }, (_, i) =>
    `<span class="dot${i < level ? '' : ' empty'}"></span>`
  ).join('');
}

const overlay    = document.getElementById('modalOverlay');
const modalImg   = document.getElementById('modalImg');
const modalNum   = document.getElementById('modalNum');
const modalCat   = document.getElementById('modalCat');
const modalName  = document.getElementById('modalName');
const modalGrid  = document.getElementById('modalGrid');
const modalNote  = document.getElementById('modalNote');
const closeBtn   = document.getElementById('modalClose');
const archiveRows = document.getElementById('archiveRows');
const MENU_STATE_URL = '/api/menu-state';
const MENU_PUBLISH_URL = '/api/menu-state/publish';
const escapeHtml = window.AKO.escapeHtml; // shared with script.js (loaded first)

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/["'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getCurrentDrinkNameSet() {
  const names = new Set();
  // Archive rows live inside #panel-current too — counting them would make
  // each archive re-render hide a different set of archived drinks.
  document.querySelectorAll('#panel-current .menu-section:not(#archiveSection) .mrow-name').forEach(item => {
    names.add(normalizeName(item.textContent));
  });
  return names;
}

function ensureArchiveData(id, item, num) {
  if (!id || !item) return;

  MENU_IMAGES[id] = item.image || '';
  MENU_DATA[id] = {
    num: item.num || `#A${String(num + 1).padStart(2, '0')}`,
    cat: item.category || 'Archive',
    name: item.name || 'Archived Drink',
    ingredients: Array.isArray(item.ingredients) && item.ingredients.length ? item.ingredients : ['Archive item'],
    profile: item.profile || { Classic: 3, Smooth: 3, Sweet: 3 },
    note: item.note || 'Archived menu item.',
  };
}

const MENU_STATE_KEY = 'ako_menu_state_v1';
const MENU_HISTORY_KEY = 'ako_menu_history_v1';
const MENU_HISTORY_LIMIT = 40;

let menuHistory = {
  undo: [],
  redo: [],
};
let remoteSaveChain = Promise.resolve();

function cloneSnapshot(snapshot) {
  return JSON.parse(JSON.stringify(snapshot));
}

function createMenuRowElement(rowData) {
  const row = document.createElement('div');
  row.className = 'mrow';
  row.dataset.id = rowData.id || '';

  const left = document.createElement('div');
  left.className = 'mrow-left';

  const name = document.createElement('div');
  name.className = 'mrow-name';
  name.textContent = rowData.name || 'Untitled Drink';
  left.appendChild(name);

  if (rowData.desc) {
    const desc = document.createElement('div');
    desc.className = 'mrow-desc';
    desc.textContent = rowData.desc;
    left.appendChild(desc);
  }

  const arrow = document.createElement('span');
  arrow.className = 'mrow-arrow';
  arrow.textContent = '→';

  row.append(left, arrow);
  return row;
}

// A drink's description lives on its row (that's what the snapshot saves);
// MENU_DATA.desc mirrors it once the drink has been edited.
function getMenuDrinkDescription(id) {
  const data = MENU_DATA[id] || {};
  if (typeof data.desc === 'string') return data.desc;
  const archived = ARCHIVE_MENU_ITEMS.find(entry => entry.id === id);
  if (archived) return archived.desc || archived.description || '';
  const row = document.querySelector(`.mrow[data-id="${CSS.escape(id)}"] .mrow-desc`);
  return row ? row.textContent.trim() : (data.description || '');
}

function setMenuRowDescription(row, desc) {
  let descEl = row.querySelector('.mrow-desc');
  if (!desc) {
    if (descEl) descEl.remove();
    return;
  }
  if (!descEl) {
    descEl = document.createElement('div');
    descEl.className = 'mrow-desc';
    row.querySelector('.mrow-left')?.appendChild(descEl);
  }
  descEl.textContent = desc;
}

function createMenuSectionElement(titleText) {
  const section = document.createElement('section');
  section.className = 'menu-section';

  const title = document.createElement('h2');
  title.className = 'menu-section-title';
  title.textContent = titleText;
  section.appendChild(title);
  return section;
}

// Current-menu sections always sit above the Archive section.
function insertMenuSectionBeforeArchive(currentPanel, section) {
  currentPanel.insertBefore(section, currentPanel.querySelector(':scope > #archiveSection'));
}

function ensureCurrentMenuSection() {
  const currentPanel = document.getElementById('panel-current');
  if (!currentPanel) return null;

  const sections = [...currentPanel.querySelectorAll('.menu-section')].filter(s => s.id !== 'archiveSection');
  let section = sections[sections.length - 1];
  if (section) return section;

  section = createMenuSectionElement('CURRENT MENU');
  insertMenuSectionBeforeArchive(currentPanel, section);
  return section;
}

// Toolbar "Create Section": adds an empty section right after the selected
// drink's section, or at the end of the current menu if nothing is selected.
// Drinks are then dragged into it; empty sections are hidden from customers.
function createMenuSection() {
  const currentPanel = document.getElementById('panel-current');
  if (!currentPanel) return;

  const input = window.prompt('Name for the new menu section:');
  if (input === null) return;
  const titleText = input.trim();
  if (!titleText) {
    alert('Section name cannot be blank.');
    return;
  }

  const existingNames = [...currentPanel.querySelectorAll('.menu-section:not(#archiveSection) .menu-section-title')]
    .map(el => normalizeName(el.textContent));
  if (existingNames.includes(normalizeName(titleText))) {
    alert(`There is already a section called "${titleText}".`);
    return;
  }

  const section = createMenuSectionElement(titleText);
  const selected = currentPanel.querySelector('.menu-section:not(#archiveSection) .mrow.is-selected');
  const afterSection = selected ? selected.closest('.menu-section') : null;
  if (afterSection) afterSection.after(section); else insertMenuSectionBeforeArchive(currentPanel, section);

  recordMenuChange();
  section.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function buildCurrentSectionsSnapshot() {
  const sections = [...document.querySelectorAll('#panel-current .menu-section')]
    .filter(section => section.id !== 'archiveSection')
    .map(section => ({
    title: section.querySelector('.menu-section-title')?.textContent?.trim() || '',
    rows: [...section.querySelectorAll('.mrow')].map(row => {
      const id = row.dataset.id || '';
      const data = MENU_DATA[id] || {};
      return {
        id,
        name: row.querySelector('.mrow-name')?.textContent?.trim() || data.name || 'Untitled Drink',
        desc: row.querySelector('.mrow-desc')?.textContent?.trim() || data.desc || data.description || '',
      };
    }),
  }));

  const looseRows = [...document.querySelectorAll('#panel-current > .mrow')].map(row => {
    const id = row.dataset.id || '';
    const data = MENU_DATA[id] || {};
    return {
      id,
      name: row.querySelector('.mrow-name')?.textContent?.trim() || data.name || 'Untitled Drink',
      desc: row.querySelector('.mrow-desc')?.textContent?.trim() || data.desc || data.description || '',
    };
  });

  if (looseRows.length) {
    sections.push({
      title: 'CURRENT MENU',
      rows: looseRows,
    });
  }

  return sections;
}

function buildMenuSnapshot() {
  return {
    menuData: cloneSnapshot(MENU_DATA),
    menuImages: cloneSnapshot(MENU_IMAGES),
    archiveItems: cloneSnapshot(ARCHIVE_MENU_ITEMS),
    currentSections: buildCurrentSectionsSnapshot(),
  };
}

function snapshotsEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

// localStorage is only a local cache — the server is the source of truth.
// A quota error here (e.g. staged base64 images) must never throw, or it
// aborts an editor action halfway through.
function safeLocalStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`[menu] could not cache ${key} locally:`, error);
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }
}

function persistMenuSnapshot(snapshot) {
  safeLocalStorageSet(MENU_STATE_KEY, JSON.stringify(snapshot));
}

function persistMenuHistory() {
  safeLocalStorageSet(MENU_HISTORY_KEY, JSON.stringify(menuHistory));
}

function renderCurrentSections(currentSections) {
  const currentPanel = document.getElementById('panel-current');
  if (!currentPanel) return;

  const archiveEl = currentPanel.querySelector('#archiveSection');

  currentPanel.innerHTML = '';

  currentSections.forEach(sectionData => {
    const sectionTitle = (sectionData.title || '').trim();
    if (!sectionTitle) {
      // Drop stale/corrupt sections with no real title (e.g. old Archive
      // capture bug) rather than showing a fallback "UNTITLED SECTION" —
      // but log it, since this otherwise makes drinks disappear with zero
      // visible trace if a section ever ends up blank-titled some other way.
      console.warn('[menu] dropping a saved section with a blank title — rows:', (sectionData.rows || []).map(r => r.id));
      return;
    }

    const section = createMenuSectionElement(sectionTitle);

    (sectionData.rows || []).forEach(rowData => {
      section.appendChild(createMenuRowElement(rowData));
    });

    currentPanel.appendChild(section);
  });

  if (archiveEl) currentPanel.appendChild(archiveEl);
}

function applyMenuSnapshot(snapshot, options = {}) {
  if (!snapshot) return;

  Object.keys(MENU_DATA).forEach(key => delete MENU_DATA[key]);
  Object.assign(MENU_DATA, cloneSnapshot(snapshot.menuData || {}));

  Object.keys(MENU_IMAGES).forEach(key => delete MENU_IMAGES[key]);
  Object.assign(MENU_IMAGES, cloneSnapshot(snapshot.menuImages || {}));

  ARCHIVE_MENU_ITEMS.length = 0;
  (snapshot.archiveItems || []).forEach(item => ARCHIVE_MENU_ITEMS.push(item));

  renderCurrentSections(snapshot.currentSections || []);
  renderArchiveRows();
  bindMenuRowInteractions();

  if (options.persist !== false) {
    persistMenuSnapshot(buildMenuSnapshot());
  }
}

function handleAdminSessionExpired() {
  if (window.AKO?.editor && typeof window.AKO.editor.setEditorMode === 'function') {
    window.AKO.editor.setEditorMode(false);
  }

  if (window.AKO?.editor && typeof window.AKO.editor.openLoginModal === 'function') {
    window.AKO.editor.openLoginModal();
  }
}

async function postMenuStateToServer(snapshot) {
  const response = await fetch(MENU_STATE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ snapshot }),
  });

  const payload = await response.json().catch(() => ({}));
  if (response.status === 401) {
    handleAdminSessionExpired();
    throw new Error(payload.error || 'Your staff session expired.');
  }

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'Unable to save the shared menu state.');
  }

  return payload;
}

function syncMenuStateToServer(snapshot) {
  remoteSaveChain = remoteSaveChain
    .catch(() => undefined)
    .then(() => postMenuStateToServer(snapshot));

  remoteSaveChain.catch(error => {
    console.error('[menu] shared save failed:', error);
  });

  return remoteSaveChain;
}

// Editor changes are a local draft until staff click Save — nothing reaches
// the server (or customers) before that. The page has unsaved changes
// whenever the on-screen menu differs from the last snapshot the server
// confirmed, so undoing back to the saved state counts as clean.
let savedMenuSnapshot = null;
let menuHasUnsavedChanges = false;

function updateUnsavedMenuState() {
  menuHasUnsavedChanges = !!savedMenuSnapshot && !snapshotsEqual(buildMenuSnapshot(), savedMenuSnapshot);

  const saveBtn = document.getElementById('menuSaveBtn');
  if (saveBtn && !saveBtn.dataset.busy) {
    saveBtn.textContent = menuHasUnsavedChanges ? 'Save Changes' : 'Saved';
    saveBtn.disabled = !menuHasUnsavedChanges;
    saveBtn.classList.toggle('has-unsaved', menuHasUnsavedChanges);
  }
}

function recordMenuChange() {
  const snapshot = buildMenuSnapshot();
  const lastSnapshot = menuHistory.undo[menuHistory.undo.length - 1];

  persistMenuSnapshot(snapshot);

  if (!lastSnapshot || !snapshotsEqual(lastSnapshot, snapshot)) {
    menuHistory.undo.push(cloneSnapshot(snapshot));
    if (menuHistory.undo.length > MENU_HISTORY_LIMIT) {
      menuHistory.undo.shift();
    }
    menuHistory.redo = [];
    persistMenuHistory();
  }

  updateUnsavedMenuState();
  return snapshot;
}

// Sends the current on-screen menu to the server and makes it the new
// saved baseline. Throws on failure.
async function commitMenuToServer() {
  const snapshot = buildMenuSnapshot();
  await syncMenuStateToServer(cloneSnapshot(snapshot));
  savedMenuSnapshot = snapshot;
  updateUnsavedMenuState();
}

async function saveMenuChanges() {
  const saveBtn = document.getElementById('menuSaveBtn');
  if (saveBtn) {
    saveBtn.dataset.busy = '1';
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
  }

  try {
    await commitMenuToServer();
    return true;
  } catch (error) {
    alert(`Could not save your menu changes: ${error.message}`);
    return false;
  } finally {
    if (saveBtn) delete saveBtn.dataset.busy;
    updateUnsavedMenuState();
  }
}

function discardMenuChanges() {
  if (!savedMenuSnapshot) return;
  applyMenuSnapshot(cloneSnapshot(savedMenuSnapshot));
  menuHistory = { undo: [buildMenuSnapshot()], redo: [] };
  persistMenuHistory();
  updateUnsavedMenuState();
}

// Called by the toolbar's Exit Editor button; false means stay in the editor.
function confirmLeaveMenuEditor() {
  if (!menuHasUnsavedChanges) return true;
  if (!window.confirm('You have unsaved menu changes. Are you sure you want to exit? Your changes will be discarded.')) {
    return false;
  }
  discardMenuChanges();
  return true;
}

window.addEventListener('beforeunload', (event) => {
  if (!menuHasUnsavedChanges) return;
  event.preventDefault();
  event.returnValue = ''; // browsers show their own "Leave site?" text
});

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's'
    && document.body.classList.contains('editor-enabled')) {
    event.preventDefault();
    if (menuHasUnsavedChanges) saveMenuChanges();
  }
});

function applyLocalMenuStateFallback() {
  const raw = localStorage.getItem(MENU_STATE_KEY);
  if (!raw) return false;

  try {
    const snapshot = JSON.parse(raw);
    applyMenuSnapshot(snapshot, { persist: false });
    return true;
  } catch (error) {
    console.warn('Unable to restore saved menu state:', error);
    localStorage.removeItem(MENU_STATE_KEY);
    return false;
  }
}

async function loadMenuStateFromServer() {
  try {
    const response = await fetch(MENU_STATE_URL, { credentials: 'same-origin', cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'Unable to load shared menu state.');
    }

    if (!payload.snapshot) return false;

    applyMenuSnapshot(payload.snapshot, { persist: true });
    return true;
  } catch (error) {
    console.warn('[menu] shared load failed:', error);
    return null;
  }
}

function initializeMenuHistory() {
  const raw = localStorage.getItem(MENU_HISTORY_KEY);
  const currentSnapshot = buildMenuSnapshot();

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.undo) && Array.isArray(parsed.redo) && parsed.undo.length) {
        const latestSaved = parsed.undo[parsed.undo.length - 1];
        if (!snapshotsEqual(latestSaved, currentSnapshot)) {
          throw new Error('History no longer matches current menu state.');
        }
        menuHistory = {
          undo: parsed.undo,
          redo: parsed.redo,
        };
        return;
      }
    } catch (error) {
      console.warn('Unable to restore menu history:', error);
    }
  }

  menuHistory = {
    undo: [currentSnapshot],
    redo: [],
  };
  persistMenuHistory();
}

const IMAGE_MIME_EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

// Any image picked via the file input is staged locally as a base64 data URL
// (see the file-input handler in ensureMenuEditorModal) so routine edits
// never touch GitHub. Only at Publish time do staged images become real
// committed files — this runs first so the JSON snapshot published right
// after references real paths, not multi-megabyte base64 blobs.
async function resolveStagedImagesToGitHub() {
  // Archived drinks keep their own copy of the image (ARCHIVE_MENU_ITEMS),
  // so both places need resolving; the same data URL is uploaded only once.
  const uploadedPaths = new Map();

  async function resolve(id, value) {
    const match = /^data:([^;]+);base64,/.exec(value || '');
    if (!match) return value;
    if (uploadedPaths.has(value)) return uploadedPaths.get(value);

    const ext = IMAGE_MIME_EXTENSIONS[match[1]] || 'png';
    const response = await fetch('/api/github/upload-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ dataUrl: value, folder: 'Pictures/menu', filename: `${id}.${ext}` }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || `Failed to upload image for "${id}".`);
    }
    uploadedPaths.set(value, payload.path);
    return payload.path;
  }

  for (const [id, value] of Object.entries(MENU_IMAGES)) {
    MENU_IMAGES[id] = await resolve(id, value);
  }
  for (const item of ARCHIVE_MENU_ITEMS) {
    if (item.image) item.image = await resolve(item.id || 'archive', item.image);
  }
}

async function publishMenuStateToGitHub() {
  await resolveStagedImagesToGitHub();
  await commitMenuToServer(); // publishing also saves any unsaved changes

  const response = await fetch(MENU_PUBLISH_URL, {
    method: 'POST',
    credentials: 'same-origin',
  });

  const payload = await response.json().catch(() => ({}));
  if (response.status === 401) {
    handleAdminSessionExpired();
    throw new Error(payload.error || 'Your staff session expired.');
  }

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'GitHub publish failed.');
  }

  const commitSha = payload.publishResult?.commitSha;
  alert(commitSha ? `Published to GitHub. Commit ${commitSha.slice(0, 7)}.` : 'Published to GitHub.');
  return payload;
}

function undoMenuChange() {
  if (menuHistory.undo.length <= 1) {
    alert('Nothing to undo yet.');
    return;
  }

  const currentSnapshot = menuHistory.undo.pop();
  menuHistory.redo.push(cloneSnapshot(currentSnapshot));

  const previousSnapshot = cloneSnapshot(menuHistory.undo[menuHistory.undo.length - 1]);
  applyMenuSnapshot(previousSnapshot);
  persistMenuHistory();
  updateUnsavedMenuState();
}

function redoMenuChange() {
  if (!menuHistory.redo.length) {
    alert('Nothing to redo yet.');
    return;
  }

  const nextSnapshot = cloneSnapshot(menuHistory.redo.pop());
  menuHistory.undo.push(cloneSnapshot(nextSnapshot));
  applyMenuSnapshot(nextSnapshot);
  persistMenuHistory();
  updateUnsavedMenuState();
}

function renderArchiveRows() {
  if (!archiveRows) return;

  const currentNames = getCurrentDrinkNameSet();
  const uniqueArchived = [];
  const seenArchiveNames = new Set();

  ARCHIVE_MENU_ITEMS.forEach(item => {
    const normalized = normalizeName(item && item.name);
    if (!normalized) return;
    if (currentNames.has(normalized)) return;
    if (seenArchiveNames.has(normalized)) return;
    seenArchiveNames.add(normalized);
    uniqueArchived.push(item);
  });

  if (!uniqueArchived.length) {
    archiveRows.innerHTML = '<p class="archive-empty">No archived drinks yet. Paste your old menu code and I will auto-format it here.</p>';
    return;
  }

  const grouped = new Map();
  uniqueArchived.forEach((item, idx) => {
    const category = item.category || 'Archive';
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category).push({ item, idx });
  });

  archiveRows.innerHTML = Array.from(grouped.entries()).map(([category, entries]) => {
    const rowsHtml = entries.map(({ item, idx }) => {
      const id = item.id || `archive-${idx + 1}`;
      ensureArchiveData(id, item, idx);
      return `
        <div class="mrow" data-id="${escapeHtml(id)}">
          <div class="mrow-left">
            <div class="mrow-name">${escapeHtml(item.name || 'Archived Drink')}</div>
            <div class="mrow-desc">${escapeHtml(item.desc || item.description || '')}</div>
          </div>
          <span class="mrow-arrow">→</span>
        </div>`;
    }).join('');

    return `
      <section class="archive-group">
        <h3 class="archive-group-title">${escapeHtml(category)}</h3>
        <div class="archive-group-rows">${rowsHtml}</div>
      </section>`;
  }).join('');

  // In editor mode a click selects the row instead (bindMenuRowInteractions).
  archiveRows.querySelectorAll('.mrow').forEach(row => {
    row.addEventListener('click', () => {
      if (!document.body.classList.contains('editor-enabled')) openModal(row.dataset.id);
    });
  });
}

function setupMenuTabs() {
  // "Archive" used to be a second tab here, wired to a #panel-archive panel
  // that was never actually built — Archive has always really been the
  // collapsible section at the bottom of #panel-current (see #archiveToggle
  // below). The dead tab button was removed; #panel-current is the only
  // real panel now.
  const tabs = document.querySelectorAll('.menu-tab');
  const panels = {
    current: document.getElementById('panel-current'),
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const panelKey = tab.dataset.panel;
      tabs.forEach(btn => {
        const selected = btn === tab;
        btn.classList.toggle('active', selected);
        btn.setAttribute('aria-selected', selected ? 'true' : 'false');
      });

      Object.entries(panels).forEach(([key, panel]) => {
        if (!panel) return;
        const isActive = key === panelKey;
        panel.classList.toggle('is-active', isActive);
        panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
      });
    });
  });
}

function openModal(id) {
  const d = MENU_DATA[id];
  if (!d) return;

  modalImg.src          = MENU_IMAGES[id] || '';
  modalImg.alt          = d.name;
  modalNum.textContent  = d.num;
  modalCat.textContent  = d.cat;
  modalName.textContent = d.name;
  modalNote.textContent = d.note;

  modalGrid.innerHTML = `
    <div>
      <div class="modal-field-label">Ingredients</div>
      <div class="modal-field-val">${d.ingredients.join('<br>')}</div>
    </div>
    <div>
      <div class="modal-field-label">Profile</div>
      ${Object.entries(d.profile).map(([k, v]) => `
        <div class="modal-profile-row">
          <span class="modal-profile-key">${k}</span>
          <span class="modal-dots">${buildDots(v)}</span>
        </div>`).join('')}
    </div>`;

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function bindMenuRowInteractions() {
  document.querySelectorAll('.mrow').forEach(row => {
    row.draggable = false;
    row.onclick = () => {
      if (document.body.classList.contains('editor-enabled')) {
        document.querySelectorAll('.mrow').forEach(item => {
          item.classList.toggle('is-selected', item === row);
        });
        return;
      }
      openModal(row.dataset.id);
    };
  });
}

// ── Drag to reorder / move drinks between sections (editor mode) ──
// Built on pointer events so one code path handles mouse and touch. A mouse
// drag starts after a small move; a touch drag starts after a short
// press-and-hold, so an ordinary swipe still scrolls the page. The real row
// moves live as a placeholder while a floating copy follows the pointer.
// Dropping a current drink on the Archive section archives it; dragging an
// archived drink into a section restores it at that spot.
const DRAG_MOUSE_THRESHOLD = 6;
const DRAG_TOUCH_HOLD_MS = 280;
const DRAG_TOUCH_SLOP = 10;
const DRAG_AUTOSCROLL_EDGE = 70;

let menuDrag = null;
let suppressRowClickUntil = 0;

function onMenuRowPointerDown(event) {
  if (!document.body.classList.contains('editor-enabled') || menuDrag) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  const row = event.target.closest('#panel-current .mrow');
  if (!row) return;

  menuDrag = {
    row,
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    startX: event.clientX,
    startY: event.clientY,
    x: event.clientX,
    y: event.clientY,
    active: false,
    holdTimer: 0,
    scrollFrame: 0,
    ghost: null,
    offsetX: 0,
    offsetY: 0,
    targetSection: null,
    fromArchive: !!row.closest('#archiveRows'),
    originParent: row.parentNode,
    originNext: row.nextSibling,
  };

  if (event.pointerType !== 'mouse') {
    menuDrag.holdTimer = setTimeout(startMenuDrag, DRAG_TOUCH_HOLD_MS);
  }

  window.addEventListener('pointermove', onMenuDragPointerMove);
  window.addEventListener('pointerup', onMenuDragPointerUp);
  window.addEventListener('pointercancel', cancelMenuDrag);
}

function onMenuDragPointerMove(event) {
  const drag = menuDrag;
  if (!drag || event.pointerId !== drag.pointerId) return;
  drag.x = event.clientX;
  drag.y = event.clientY;

  if (!drag.active) {
    const distance = Math.hypot(drag.x - drag.startX, drag.y - drag.startY);
    if (drag.pointerType === 'mouse') {
      if (distance >= DRAG_MOUSE_THRESHOLD) startMenuDrag();
    } else if (distance > DRAG_TOUCH_SLOP) {
      endMenuDrag(); // moved before the hold finished — it's a scroll, not a drag
    }
    return;
  }

  event.preventDefault();
  updateMenuDrag();
}

function startMenuDrag() {
  const drag = menuDrag;
  if (!drag || drag.active) return;
  clearTimeout(drag.holdTimer);
  drag.active = true;

  const rect = drag.row.getBoundingClientRect();
  drag.offsetX = drag.startX - rect.left;
  drag.offsetY = drag.startY - rect.top;

  const ghost = drag.row.cloneNode(true);
  ghost.classList.remove('is-selected', 'dragging');
  ghost.classList.add('mrow-drag-ghost');
  ghost.removeAttribute('data-id');
  ghost.style.width = `${rect.width}px`;
  document.body.appendChild(ghost);
  drag.ghost = ghost;

  drag.row.classList.add('dragging');
  document.body.classList.add('menu-dragging');
  if (drag.pointerType === 'touch' && navigator.vibrate) navigator.vibrate(10);

  updateMenuDrag();
  drag.scrollFrame = requestAnimationFrame(autoScrollMenuDrag);
}

function updateMenuDrag() {
  const drag = menuDrag;
  if (!drag || !drag.active) return;

  drag.ghost.style.transform = `translate(${drag.x - drag.offsetX}px, ${drag.y - drag.offsetY}px)`;

  const hit = document.elementFromPoint(drag.x, drag.y);
  const section = hit ? hit.closest('#panel-current .menu-section') : null;
  if (!section) return; // in a gap between sections — keep the last position

  if (section !== drag.targetSection) {
    if (drag.targetSection) drag.targetSection.classList.remove('drag-over');
    section.classList.add('drag-over');
    drag.targetSection = section;
  }

  if (section.id === 'archiveSection') {
    // Nothing reorders inside Archive; park the row back where it started
    // until it's dropped (archived) or dragged back out.
    if (drag.row.parentNode !== drag.originParent || drag.row.nextSibling !== drag.originNext) {
      drag.originParent.insertBefore(drag.row, drag.originNext);
    }
    return;
  }

  const rows = [...section.querySelectorAll(':scope > .mrow')].filter(item => item !== drag.row);
  const before = rows.find(item => {
    const box = item.getBoundingClientRect();
    return drag.y < box.top + box.height / 2;
  }) || null;

  if (before) {
    if (drag.row.nextElementSibling !== before) section.insertBefore(drag.row, before);
  } else if (section.lastElementChild !== drag.row) {
    section.appendChild(drag.row);
  }
}

function autoScrollMenuDrag() {
  const drag = menuDrag;
  if (!drag || !drag.active) return;

  let delta = 0;
  if (drag.y < DRAG_AUTOSCROLL_EDGE) {
    delta = -Math.ceil((DRAG_AUTOSCROLL_EDGE - drag.y) / 4);
  } else if (drag.y > window.innerHeight - DRAG_AUTOSCROLL_EDGE) {
    delta = Math.ceil((drag.y - (window.innerHeight - DRAG_AUTOSCROLL_EDGE)) / 4);
  }

  if (delta) {
    window.scrollBy(0, delta);
    updateMenuDrag();
  }
  drag.scrollFrame = requestAnimationFrame(autoScrollMenuDrag);
}

function endMenuDrag() {
  const drag = menuDrag;
  if (!drag) return;

  clearTimeout(drag.holdTimer);
  cancelAnimationFrame(drag.scrollFrame);
  if (drag.ghost) drag.ghost.remove();
  drag.row.classList.remove('dragging');
  if (drag.targetSection) drag.targetSection.classList.remove('drag-over');
  document.body.classList.remove('menu-dragging');

  window.removeEventListener('pointermove', onMenuDragPointerMove);
  window.removeEventListener('pointerup', onMenuDragPointerUp);
  window.removeEventListener('pointercancel', cancelMenuDrag);
  menuDrag = null;
}

function cancelMenuDrag() {
  const drag = menuDrag;
  if (!drag) return;
  if (drag.active) drag.originParent.insertBefore(drag.row, drag.originNext);
  endMenuDrag();
}

function onMenuDragPointerUp(event) {
  const drag = menuDrag;
  if (!drag || event.pointerId !== drag.pointerId) return;
  if (!drag.active) {
    endMenuDrag(); // a plain click/tap — the row's click handler selects it
    return;
  }

  // The click that follows pointerup would select/deselect a row — ignore it.
  suppressRowClickUntil = Date.now() + 400;

  const section = drag.targetSection;
  const droppedOnArchive = !!section && section.id === 'archiveSection';
  const moved = drag.row.parentNode !== drag.originParent || drag.row.nextSibling !== drag.originNext;
  endMenuDrag();

  if (drag.fromArchive) {
    if (!section || droppedOnArchive || !moved) {
      drag.originParent.insertBefore(drag.row, drag.originNext);
      return;
    }
    let beforeRow = drag.row.nextElementSibling;
    while (beforeRow && !beforeRow.classList.contains('mrow')) beforeRow = beforeRow.nextElementSibling;
    drag.row.remove();
    restoreArchiveItem(drag.row.dataset.id, section, beforeRow);
    return;
  }

  if (droppedOnArchive) {
    archiveCurrentRow(drag.row);
    return;
  }

  if (moved) recordMenuChange();
}

document.addEventListener('pointerdown', onMenuRowPointerDown);

// Once a touch drag has started, stop the browser from scrolling instead.
document.addEventListener('touchmove', (event) => {
  if (menuDrag && menuDrag.active) event.preventDefault();
}, { passive: false });

// Long-press on touch would otherwise open the context/callout menu.
document.addEventListener('contextmenu', (event) => {
  if (menuDrag) event.preventDefault();
});

document.addEventListener('click', (event) => {
  if (Date.now() < suppressRowClickUntil && event.target.closest('#panel-current')) {
    suppressRowClickUntil = 0;
    event.stopPropagation();
    event.preventDefault();
  }
}, true);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuDrag && menuDrag.active) cancelMenuDrag();
});

function editSelectedDrink() {
  const selected = document.querySelector('.mrow.is-selected');
  if (!selected) {
    alert('Select a drink first.');
    return;
  }

  openMenuEditorForRow(selected.dataset.id, selected.closest('#archiveRows') ? 'archive' : 'current');
}

function parsePromptText(input) {
  const lines = String(input || '').split(/\n+/).map(line => line.trim()).filter(Boolean);
  const data = {};

  lines.forEach(line => {
    if (line.startsWith('Name:')) data.name = line.replace(/^Name:\s*/, '').trim();
    else if (line.startsWith('Description:')) data.description = line.replace(/^Description:\s*/, '').trim();
    else if (line.startsWith('Image path:')) data.image = line.replace(/^Image path:\s*/, '').trim();
    else if (line.startsWith('Category:')) data.category = line.replace(/^Category:\s*/, '').trim();
    else if (line.startsWith('Ingredients:')) {
      data.ingredients = line.replace(/^Ingredients:\s*/, '').split(',').map(entry => entry.trim()).filter(Boolean);
    } else if (line.startsWith('Profile:')) {
      const raw = line.replace(/^Profile:\s*/, '').trim();
      const entries = raw.split(',').map(entry => entry.trim()).filter(Boolean);
      const profile = {};
      entries.forEach(entry => {
        const match = entry.match(/^(.+?)\s+(\d+)$/);
        if (match) profile[match[1].trim()] = Number(match[2]);
      });
      if (Object.keys(profile).length) data.profile = profile;
    } else if (line.startsWith('Note:')) data.note = line.replace(/^Note:\s*/, '').trim();
  });

  return data;
}

function ensureMenuEditorModal() {
  if (document.getElementById('menuEditorModal')) return;

  const modal = document.createElement('div');
  modal.id = 'menuEditorModal';
  modal.className = 'menu-editor-modal hidden';
  modal.innerHTML = `
    <div class="menu-editor-panel" role="dialog" aria-modal="true" aria-labelledby="menuEditorTitle">
      <button type="button" class="menu-editor-close" aria-label="Close editor">×</button>
      <h3 id="menuEditorTitle">Edit Drink</h3>
      <form id="menuEditorForm" class="menu-editor-form">
        <label>
          Name
          <input id="menuEditorName" name="name" type="text" />
        </label>
        <label>
          Description
          <textarea id="menuEditorDescription" name="description" rows="3"></textarea>
        </label>
        <label>
          Image URL
          <input id="menuEditorImageUrl" name="imageUrl" type="text" placeholder="Pictures/menu/current/your-drink.jpg" />
        </label>
        <label>
          Upload new image
          <input id="menuEditorImageUpload" name="imageUpload" type="file" accept="image/*" />
        </label>
        <img id="menuEditorPreview" class="menu-editor-preview" alt="Drink preview" />
        <label>
          Ingredients
          <input id="menuEditorIngredients" name="ingredients" type="text" placeholder="Tea, citrus, milk" />
        </label>
        <label>
          Profile
          <input id="menuEditorProfile" name="profile" type="text" placeholder="Citrus 5, Sweet 3, Floral 4" />
        </label>
        <label>
          Note
          <textarea id="menuEditorNote" name="note" rows="3"></textarea>
        </label>
        <div class="menu-editor-actions">
          <button type="button" class="secondary-btn" id="menuEditorCancel">Cancel</button>
          <button type="submit">Update Drink</button>
        </div>
      </form>
    </div>
  `;

  const fileInput = modal.querySelector('#menuEditorImageUpload');
  const preview = modal.querySelector('#menuEditorPreview');
  const imageUrlInput = modal.querySelector('#menuEditorImageUrl');

  fileInput.addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await window.AKO.readImageFileAsDataUrl(file);
      preview.src = dataUrl;
      preview.classList.add('visible');
      imageUrlInput.value = dataUrl;
    } catch (error) {
      console.error('[menu] image read failed:', error);
      alert('Could not read that image. Try a JPG or PNG.');
    }
  });

  window.AKO.wireModalDismiss(modal, 'menuEditorCancel');

  modal.querySelector('#menuEditorForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const id = form.dataset.editId;
    const source = form.dataset.source || 'current';
    if (!id) return;

    const nameValue = document.getElementById('menuEditorName').value.trim() || 'Untitled Drink';
    const descriptionValue = document.getElementById('menuEditorDescription').value.trim();
    const imageValue = document.getElementById('menuEditorImageUrl').value.trim();
    const ingredientsValue = document.getElementById('menuEditorIngredients').value.split(',').map(part => part.trim()).filter(Boolean);
    const profileValue = document.getElementById('menuEditorProfile').value;
    const noteValue = document.getElementById('menuEditorNote').value.trim();

    const parsedProfile = {};
    profileValue.split(',').map(part => part.trim()).filter(Boolean).forEach(part => {
      const match = part.match(/^(.+?)\s+(\d+)$/);
      if (match) parsedProfile[match[1].trim()] = Number(match[2]);
    });

    const base = MENU_DATA[id] || {};
    const record = {
      num: base.num || `#${String(Object.keys(MENU_DATA).length + 1).padStart(2, '0')}`,
      cat: base.cat || (source === 'archive' ? 'Archive' : 'Current Menu'),
      name: nameValue,
      ingredients: ingredientsValue.length ? ingredientsValue : (base.ingredients || ['House blend']),
      profile: Object.keys(parsedProfile).length ? parsedProfile : (base.profile || { Smooth: 3, Sweet: 3, Bright: 3 }),
      note: noteValue || (base.note || 'Updated in editor mode.'),
      // The form is pre-filled with the current description, so whatever is
      // in the box now (including empty, to clear it) is what staff intend.
      desc: descriptionValue,
      image: imageValue || (MENU_IMAGES[id] || 'Pictures/menu/current/custom.jpg'),
      category: base.category || base.cat || 'Current Menu',
    };

    MENU_DATA[id] = {
      ...base,
      num: record.num,
      cat: record.cat,
      name: record.name,
      ingredients: record.ingredients,
      profile: record.profile,
      note: record.note,
      desc: record.desc,
    };
    MENU_IMAGES[id] = record.image;

    // Archived drinks are re-derived from ARCHIVE_MENU_ITEMS on every archive
    // render, so the edit has to land there too or it would be overwritten.
    const archiveItem = ARCHIVE_MENU_ITEMS.find(entry => entry.id === id);
    if (archiveItem) {
      Object.assign(archiveItem, {
        name: record.name,
        desc: record.desc,
        image: record.image,
        ingredients: record.ingredients,
        profile: record.profile,
        note: record.note,
      });
      delete archiveItem.description;
    }

    document.querySelectorAll('.mrow[data-id="' + id + '"]').forEach(row => {
      const nameEl = row.querySelector('.mrow-name');
      if (nameEl) nameEl.textContent = record.name;
      setMenuRowDescription(row, record.desc);
    });

    if (archiveItem) {
      renderArchiveRows();
      bindMenuRowInteractions();
    }

    modal.classList.add('hidden');
    form.reset();
    preview.classList.remove('visible');
    recordMenuChange();
  });

  document.body.appendChild(modal);
}

function openMenuEditorForRow(id, source = 'current') {
  if (!id) return;
  ensureMenuEditorModal();

  const modal = document.getElementById('menuEditorModal');
  if (!modal) return;

  const form = document.getElementById('menuEditorForm');
  const item = MENU_DATA[id] || {};
  const imageValue = MENU_IMAGES[id] || item.image || '';

  form.dataset.editId = id;
  form.dataset.source = source;
  document.getElementById('menuEditorName').value = item.name || '';
  document.getElementById('menuEditorDescription').value = getMenuDrinkDescription(id);
  document.getElementById('menuEditorImageUrl').value = imageValue;
  document.getElementById('menuEditorIngredients').value = Array.isArray(item.ingredients) ? item.ingredients.join(', ') : '';
  document.getElementById('menuEditorProfile').value = item.profile ? Object.entries(item.profile).map(([key, value]) => `${key} ${value}`).join(', ') : '';
  document.getElementById('menuEditorNote').value = item.note || '';

  const preview = document.getElementById('menuEditorPreview');
  if (imageValue) {
    preview.src = imageValue;
    preview.classList.add('visible');
  } else {
    preview.removeAttribute('src');
    preview.classList.remove('visible');
  }

  modal.classList.remove('hidden');
}

function ensureDrinkPromptModal() {
  if (document.getElementById('drinkPromptModal')) return;

  const modal = document.createElement('div');
  modal.id = 'drinkPromptModal';
  modal.className = 'drink-prompt-modal hidden';
  modal.innerHTML = `
    <div class="drink-prompt-panel" role="dialog" aria-modal="true" aria-labelledby="drinkPromptTitle">
      <button type="button" class="menu-editor-close" aria-label="Close prompt">×</button>
      <h3 id="drinkPromptTitle">Add Drink</h3>
      <p>Use this format exactly. The text box can scroll if you need more space.</p>
      <textarea id="drinkPromptTextarea" class="drink-prompt-textarea"></textarea>
      <div class="drink-prompt-actions">
        <button type="button" id="drinkPromptCancel" class="secondary-btn">Cancel</button>
        <button type="button" id="drinkPromptSave">Add Drink</button>
      </div>
    </div>
  `;

  const textArea = modal.querySelector('#drinkPromptTextarea');
  const example = `Name: Sunset Yuzu Tea
Description: Bright citrus tea with floral finish and soft sweetness
Image path: Pictures/menu/current/sunset-yuzu.jpg
Category: Current Menu
Ingredients: Yuzu, black tea, honey, lemon peel
Profile: Citrus 5, Sweet 3, Floral 4
Note: Seasonal favorite with a soft, clean finish`;
  textArea.value = example;

  window.AKO.wireModalDismiss(modal, 'drinkPromptCancel');

  modal.querySelector('#drinkPromptSave').addEventListener('click', () => {
    const response = textArea.value.trim();
    if (!response) return;

    const parsed = parsePromptText(response);
    const id = 'custom-' + Date.now();
    const item = {
      id,
      name: parsed.name || 'Custom Drink',
      desc: parsed.description || '',
      image: parsed.image || 'Pictures/menu/current/custom.jpg',
      category: parsed.category || 'Current Menu',
      ingredients: parsed.ingredients && parsed.ingredients.length ? parsed.ingredients : ['House blend'],
      profile: parsed.profile || { Smooth: 3, Sweet: 3, Bright: 3 },
      note: parsed.note || 'Added in editor mode.',
    };

    MENU_IMAGES[id] = item.image;
    MENU_DATA[id] = {
      num: `#${String(Object.keys(MENU_DATA).length + 1).padStart(2, '0')}`,
      cat: item.category,
      name: item.name,
      ingredients: item.ingredients,
      profile: item.profile,
      note: item.note,
      desc: item.desc,
    };

    const currentPanel = document.getElementById('panel-current');
    const menuSection = ensureCurrentMenuSection();
    const row = createMenuRowElement({ id, name: item.name, desc: item.desc });

    if (menuSection) menuSection.appendChild(row); else if (currentPanel) currentPanel.appendChild(row);
    bindMenuRowInteractions();
    modal.classList.add('hidden');
    recordMenuChange();
  });

  document.body.appendChild(modal);
}

function addDrinkFromPrompt() {
  ensureDrinkPromptModal();
  const modal = document.getElementById('drinkPromptModal');
  const textArea = document.getElementById('drinkPromptTextarea');
  if (!modal || !textArea) return;

  const example = `Name: Sunset Yuzu Tea
Description: Bright citrus tea with floral finish and soft sweetness
Image path: Pictures/menu/current/sunset-yuzu.jpg
Category: Current Menu
Ingredients: Yuzu, black tea, honey, lemon peel
Profile: Citrus 5, Sweet 3, Floral 4
Note: Seasonal favorite with a soft, clean finish`;

  textArea.value = example;
  modal.classList.remove('hidden');
  setTimeout(() => textArea.focus(), 50);
}

function moveSelectedArchiveItem() {
  const selected = document.querySelector('#archiveRows .mrow.is-selected');
  if (!selected) {
    alert('Select an archived drink first.');
    return;
  }

  restoreArchiveItem(selected.dataset.id, ensureCurrentMenuSection(), null);
}

// Moves an archived drink onto the current menu, inserted into `section`
// before `beforeRow` (or at the end). Shared by the "Move to Current" button
// and drag-and-drop.
function restoreArchiveItem(id, section, beforeRow) {
  const archiveItem = ARCHIVE_MENU_ITEMS.find(entry => entry.id === id) || null;
  const menuItem = MENU_DATA[id] || {};
  const item = archiveItem || menuItem;
  const target = {
    id: id || item.id || `moved-${Date.now()}`,
    name: item.name || 'Moved Drink',
    desc: (archiveItem && (archiveItem.desc || archiveItem.description)) || item.desc || item.description || '',
    image: (archiveItem && archiveItem.image) || item.image || MENU_IMAGES[id] || 'Pictures/menu/current/custom.jpg',
    category: (archiveItem && archiveItem.category) || 'Current Menu',
    ingredients: Array.isArray(item.ingredients) && item.ingredients.length ? item.ingredients : ['House blend'],
    profile: item.profile || { Smooth: 3, Sweet: 3, Bright: 3 },
    note: item.note || '',
  };

  MENU_IMAGES[target.id] = target.image;
  MENU_DATA[target.id] = {
    num: (archiveItem && archiveItem.num) || `#${String(Object.keys(MENU_DATA).length + 1).padStart(2, '0')}`,
    cat: target.category,
    name: target.name,
    ingredients: target.ingredients,
    profile: target.profile,
    note: target.note,
    desc: target.desc,
  };

  const currentPanel = document.getElementById('panel-current');
  const row = createMenuRowElement({ id: target.id, name: target.name, desc: target.desc });

  if (section) section.insertBefore(row, beforeRow || null); else if (currentPanel) currentPanel.appendChild(row);
  const archiveIndex = ARCHIVE_MENU_ITEMS.findIndex(entry => entry.id === id);
  if (archiveIndex >= 0) ARCHIVE_MENU_ITEMS.splice(archiveIndex, 1);

  document.querySelector(`#archiveRows .mrow[data-id="${CSS.escape(id)}"]`)?.remove();
  document.querySelectorAll('.mrow').forEach(item => item.classList.remove('is-selected'));
  renderArchiveRows();
  bindMenuRowInteractions();
  recordMenuChange();
}

function moveSelectedCurrentItemToArchive() {
  const selected = document.querySelector('#panel-current .mrow.is-selected');
  if (!selected) {
    alert('Select a current menu drink first.');
    return;
  }

  archiveCurrentRow(selected);
}

// Moves a current-menu row into the archive. Shared by the "Move to Archive"
// button and dropping a drink onto the Archive section.
function archiveCurrentRow(selected) {
  const id = selected.dataset.id;
  const source = MENU_DATA[id] || {};
  const archiveEntry = {
    id: id || `archive-${Date.now()}`,
    name: source.name || selected.querySelector('.mrow-name')?.textContent?.trim() || 'Moved Drink',
    desc: selected.querySelector('.mrow-desc')?.textContent?.trim() || '',
    num: source.num,
    image: MENU_IMAGES[id] || source.image || 'Pictures/menu/current/custom.jpg',
    category: source.cat || source.category || 'Current Menu (Moved)',
    ingredients: Array.isArray(source.ingredients) && source.ingredients.length ? source.ingredients : ['House blend'],
    profile: source.profile || { Smooth: 3, Sweet: 3, Bright: 3 },
    note: source.note || '',
  };

  if (!ARCHIVE_MENU_ITEMS.some(item => item.id === archiveEntry.id)) {
    ARCHIVE_MENU_ITEMS.unshift(archiveEntry);
  }

  if (MENU_DATA[id]) {
    MENU_DATA[id].cat = 'Archive';
  }

  selected.remove();
  document.querySelectorAll('.mrow').forEach(item => item.classList.remove('is-selected'));
  renderArchiveRows();
  bindMenuRowInteractions();
  recordMenuChange();
}

function deleteSelectedDrink() {
  const selected = document.querySelector('.mrow.is-selected');
  if (!selected) {
    alert('Select a drink first.');
    return;
  }

  const id = selected.dataset.id;
  const source = selected.closest('#archiveRows') ? 'archive' : 'current';
  const itemName = (MENU_DATA[id] && MENU_DATA[id].name) || (ARCHIVE_MENU_ITEMS.find(entry => entry.id === id)?.name) || 'This drink';
  const confirmed = window.confirm(`Delete "${itemName}" from the ${source} menu?`);
  if (!confirmed) return;

  if (source === 'archive') {
    const archiveIndex = ARCHIVE_MENU_ITEMS.findIndex(entry => entry.id === id);
    if (archiveIndex >= 0) ARCHIVE_MENU_ITEMS.splice(archiveIndex, 1);
  } else {
    delete MENU_DATA[id];
    delete MENU_IMAGES[id];
  }

  selected.remove();
  document.querySelectorAll('.mrow').forEach(item => item.classList.remove('is-selected'));

  if (source === 'archive') {
    renderArchiveRows();
  }

  recordMenuChange();
}

function refreshMenuEditorState() {
  cancelMenuDrag();
  updateUnsavedMenuState(); // the toolbar (and its Save button) is rebuilt on every toggle

  if (!document.body.classList.contains('editor-enabled')) {
    document.querySelectorAll('.mrow').forEach(row => row.classList.remove('is-selected'));
    return;
  }

  bindMenuRowInteractions();
}

const menuEditorApi = {
  addDrinkFromPrompt,
  editSelectedDrink,
  deleteSelectedDrink,
  moveSelectedArchiveItem,
  moveSelectedCurrentItemToArchive,
  publishMenuStateToGitHub,
  saveMenuChanges,
  confirmLeaveMenuEditor,
  createMenuSection,
  undoMenuChange,
  redoMenuChange,
  refreshMenuEditorState,
};

window.AKOEditor = window.AKOEditor || (window.AKO && window.AKO.editor) || {};
Object.assign(window.AKOEditor, menuEditorApi);

async function initializeMenuPage() {
  setupMenuTabs();

  const sharedLoaded = await loadMenuStateFromServer();
  if (sharedLoaded !== true) {
    if (sharedLoaded === null) {
      applyLocalMenuStateFallback();
    }
    renderArchiveRows();
    bindMenuRowInteractions();
    persistMenuSnapshot(buildMenuSnapshot());
  }

  initializeMenuHistory();
  bindMenuRowInteractions();

  savedMenuSnapshot = buildMenuSnapshot();
  updateUnsavedMenuState();
}

initializeMenuPage();

closeBtn.addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── Archive toggle ──
const archiveToggle  = document.getElementById('archiveToggle');
const archiveSection = document.getElementById('archiveSection');

archiveToggle.addEventListener('click', () => {
  const isOpen = archiveSection.classList.toggle('open');
  archiveToggle.setAttribute('aria-expanded', isOpen);
});