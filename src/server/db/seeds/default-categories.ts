import type { Locale } from "~/i18n/config";

export type SeedCategoryLeaf = {
  name: Record<Locale, string>;
  icon?: string;
  keywords?: string[];
};

export type SeedCategoryParent = SeedCategoryLeaf & {
  children?: SeedCategoryLeaf[];
};

export type DefaultCategorySeed = {
  expense: SeedCategoryParent[];
  income: SeedCategoryParent[];
};

export const defaultCategories: DefaultCategorySeed = {
  expense: [
    {
      name: { da: "Bolig", en: "Home" },
      icon: "🏠",
      keywords: [],
      children: [
        {
          name: { da: "Boliglån", en: "Mortgage" },
          icon: "🏦",
          keywords: ["realkredit", "prioritet", "boliglån", "totalkredit", "nordea kredit", "nykredit"],
        },
        {
          name: { da: "Husleje", en: "Rent" },
          icon: "🔑",
          keywords: ["husleje", "leje", "boligselskab", "dab", "kab"],
        },
        {
          name: { da: "Forbrug", en: "Utilities" },
          icon: "💡",
          keywords: ["el", "vand", "varme", "fjernvarme", "naturgas", "ørsted", "norlys", "andel energi", "radius", "hofor", "evida"],
        },
        {
          name: { da: "Ejerforening", en: "HOA" },
          icon: "🏢",
          keywords: ["ejerforening", "grundejerforening", "andelsforening", "fællesudgifter"],
        },
        {
          name: { da: "Ejendomsskat", en: "Property tax" },
          icon: "📜",
          keywords: ["ejendomsskat", "grundskyld", "ejendomsværdiskat"],
        },
        {
          name: { da: "Husforsikring", en: "Home insurance" },
          icon: "🛡️",
          keywords: ["husforsikring", "bygningsforsikring", "ejerskifteforsikring"],
        },
        {
          name: { da: "Indbo- & familieforsikring", en: "Contents & family insurance" },
          icon: "🛋️",
          keywords: ["indboforsikring", "familieforsikring", "ulykkesforsikring"],
        },
        {
          name: { da: "Alarmsystem", en: "Alarm system" },
          icon: "🚨",
          keywords: ["alarm", "verisure", "g4s", "securitas"],
        },
        {
          name: { da: "Ombygning & vedligehold", en: "Renovation & maintenance" },
          icon: "🔨",
          keywords: ["ombygning", "renovering", "silvan", "bauhaus", "xl-byg", "jem & fix", "stark", "byggecenter"],
        },
        {
          name: { da: "Have & planter", en: "Garden & plants" },
          icon: "🌱",
          keywords: ["plantorama", "havecenter", "plante", "græsfrø", "bauhaus have"],
        },
        {
          name: { da: "Andet", en: "Other" },
          icon: "📦",
        },
      ],
    },
    {
      name: { da: "Transport", en: "Transport" },
      icon: "🚗",
      keywords: [],
      children: [
        {
          name: { da: "Bil-, MC- & bådlån mm.", en: "Vehicle loans" },
          icon: "🏦",
          keywords: ["billån", "mc-lån", "bådlån", "santander consumer", "nordea finans"],
        },
        {
          name: { da: "Brændstof", en: "Fuel" },
          icon: "⛽",
          keywords: ["benzin", "diesel", "shell", "circle k", "q8", "ok tank", "ingo", "uno-x", "f24"],
        },
        {
          name: { da: "Bilforsikring & autohjælp", en: "Car insurance & roadside assistance" },
          icon: "🛡️",
          keywords: ["bilforsikring", "autohjælp", "falck", "sos dansk autohjælp"],
        },
        {
          name: { da: "Ejerafgift/grøn afgift", en: "Ownership / green tax" },
          icon: "🏷️",
          keywords: ["ejerafgift", "grøn ejerafgift", "vægtafgift"],
        },
        {
          name: { da: "Offentlig transport", en: "Public transport" },
          icon: "🚆",
          keywords: ["dsb", "rejsekort", "movia", "metro", "pendlerkort", "arriva", "flixbus"],
        },
        {
          name: { da: "Taxi", en: "Taxi" },
          icon: "🚖",
          keywords: ["taxi", "uber", "dantaxi", "4x35", "bolt", "taxa"],
        },
        {
          name: { da: "Parkering", en: "Parking" },
          icon: "🅿️",
          keywords: ["parkering", "easypark", "parkpark", "apcoa", "parkeringskompagniet"],
        },
        {
          name: { da: "Værksted & service", en: "Workshop & service" },
          icon: "🔧",
          keywords: ["værksted", "bilservice", "mekaniker", "autoriseret", "dækcenter", "synshal"],
        },
        {
          name: { da: "Andet", en: "Other" },
          icon: "📦",
        },
      ],
    },
    {
      name: { da: "Husholdning", en: "Household" },
      icon: "🛒",
      keywords: [],
      children: [
        {
          name: { da: "Dagligvarer", en: "Groceries" },
          icon: "🛒",
          keywords: ["netto", "rema", "føtex", "bilka", "kvickly", "meny", "irma", "lidl", "aldi", "superbrugsen", "coop", "fakta", "salling"],
        },
        {
          name: { da: "Kiosk, bager & specialbutikker", en: "Kiosk, bakery & specialty stores" },
          icon: "🥐",
          keywords: ["kiosk", "bager", "slagter", "7-eleven", "døgner", "reitan", "lagkagehuset"],
        },
        {
          name: { da: "Kantine- & frokostordning", en: "Cafeteria & lunch plan" },
          icon: "🍱",
          keywords: ["kantine", "frokostordning", "meyers", "catering"],
        },
        {
          name: { da: "Andet", en: "Other" },
          icon: "📦",
        },
      ],
    },
    {
      name: { da: "Andre leveomkostninger", en: "Other living expenses" },
      icon: "💳",
      keywords: [],
      children: [
        {
          name: { da: "Apotek & medicin", en: "Pharmacy & medicine" },
          icon: "💊",
          keywords: ["apotek", "matas", "medicin", "apotekeren", "receptpligtig"],
        },
        {
          name: { da: "Behandling & læge", en: "Medical treatment" },
          icon: "🩺",
          keywords: ["læge", "tandlæge", "fysioterapi", "kiropraktor", "speciallæge", "psykolog"],
        },
        {
          name: { da: "Underholds- & børnebidrag", en: "Alimony & child support" },
          icon: "👨‍👩‍👧",
          keywords: ["børnebidrag", "underholdsbidrag"],
        },
        {
          name: { da: "Institution", en: "Daycare" },
          icon: "🏫",
          keywords: ["vuggestue", "børnehave", "dagpleje", "sfo", "daginstitution"],
        },
        {
          name: { da: "Fagforening & a-kasse", en: "Union & unemployment fund" },
          icon: "🤝",
          keywords: ["fagforening", "a-kasse", "ase", "krifa", "3f", "hk", "dansk metal", "magistrenes", "akademikernes"],
        },
        {
          name: { da: "Livs- & ulykkesforsikring", en: "Life & accident insurance" },
          icon: "🛡️",
          keywords: ["livsforsikring", "ulykkesforsikring", "topdanmark", "alm brand", "tryg", "if forsikring"],
        },
        {
          name: { da: "Sundheds- & sygeforsikring", en: "Health insurance" },
          icon: "🏥",
          keywords: ["sundhedsforsikring", "sygeforsikring danmark", "dagmar", "pfa helbredssikring"],
        },
        {
          name: { da: "Briller & kontaktlinser", en: "Glasses & contacts" },
          icon: "👓",
          keywords: ["briller", "kontaktlinser", "optiker", "louis nielsen", "synoptik", "smarteyes"],
        },
        {
          name: { da: "TV & streaming", en: "TV & streaming" },
          icon: "📺",
          keywords: ["netflix", "hbo", "disney+", "tv 2 play", "yousee", "viaplay", "apple tv", "paramount", "skyshowtime"],
        },
        {
          name: { da: "Telefoni & internet", en: "Phone & internet" },
          icon: "📱",
          keywords: ["telefon", "mobil", "internet", "bredbånd", "telia", "telenor", "yousee", "cbb", "oister", "fibia", "tdc"],
        },
        {
          name: { da: "Studieudgifter", en: "Study expenses" },
          icon: "🎓",
          keywords: ["studie", "lærebog", "saxo", "pensum", "studerende"],
        },
        {
          name: { da: "Foreninger & kontingenter", en: "Memberships & dues" },
          icon: "🏛️",
          keywords: ["forening", "kontingent", "medlemskab"],
        },
        {
          name: { da: "Andet", en: "Other" },
          icon: "📦",
        },
      ],
    },
    {
      name: { da: "Privatforbrug", en: "Private expenses" },
      icon: "👜",
      keywords: [],
      children: [
        {
          name: { da: "Fastfood & takeaway", en: "Fast food & takeaway" },
          icon: "🍔",
          keywords: ["mcdonalds", "burger king", "just eat", "wolt", "sunset boulevard", "dominos", "pizza"],
        },
        {
          name: { da: "Bar, café & restaurant", en: "Bar, café & restaurant" },
          icon: "🍷",
          keywords: ["restaurant", "café", "cafe", "bar", "pub", "bryggeri", "kro", "bistro", "starbucks", "baresso", "espresso house"],
        },
        {
          name: { da: "Tøj, sko & accessories", en: "Clothing, shoes & accessories" },
          icon: "👕",
          keywords: ["h&m", "zara", "magasin", "jack & jones", "vero moda", "bestseller", "zalando", "asos", "deichmann", "ecco", "uniqlo"],
        },
        {
          name: { da: "Møbler & boligudstyr", en: "Furniture & home supplies" },
          icon: "🛋️",
          keywords: ["ikea", "jysk", "ilva", "idemøbler", "bolia", "sengespecialisten", "søstrene grene", "flying tiger"],
        },
        {
          name: { da: "Elektronik & computerudstyr", en: "Electronics & computer equipment" },
          icon: "💻",
          keywords: ["elgiganten", "power", "computersalg", "proshop", "apple", "komplett", "mediamarkt"],
        },
        {
          name: { da: "Film, musik & læsestof", en: "Film, music & reading" },
          icon: "📚",
          keywords: ["bog", "avis", "blad", "spotify", "itunes", "kindle", "saxo", "politiken", "berlingske", "arnold busck", "bookbeat"],
        },
        {
          name: { da: "Online services & software", en: "Online services & software" },
          icon: "🖥️",
          keywords: ["dropbox", "icloud", "google one", "adobe", "microsoft 365", "github", "notion", "chatgpt", "openai"],
        },
        {
          name: { da: "Hobby & sportsudstyr", en: "Hobby & sports equipment" },
          icon: "🎨",
          keywords: ["stadium", "intersport", "sport 24", "panduro", "sportmaster", "hobby"],
        },
        {
          name: { da: "Biograf, koncerter & forlystelser", en: "Cinema, concerts & attractions" },
          icon: "🎬",
          keywords: ["biograf", "nordisk film", "cinemaxx", "koncert", "billetlugen", "ticketmaster", "tivoli", "bakken", "zoo"],
        },
        {
          name: { da: "Frisør & personlig pleje", en: "Hair & personal care" },
          icon: "💇",
          keywords: ["frisør", "barber", "klipning", "hairhouse", "normal"],
        },
        {
          name: { da: "Sport & fritid", en: "Sports & leisure" },
          icon: "⚽",
          keywords: ["fitness dk", "fitness world", "sats", "svømmehal", "golf", "tennis", "puregym"],
        },
        {
          name: { da: "Hus & havehjælp", en: "House & garden help" },
          icon: "🧹",
          keywords: ["rengøring", "hushjælp", "havehjælp", "hjemmeservice"],
        },
        {
          name: { da: "Spil & legetøj", en: "Games & toys" },
          icon: "🧸",
          keywords: ["lego", "br", "toys r us", "fætter br", "legetøj", "playstation", "xbox", "steam", "nintendo"],
        },
        {
          name: { da: "Tips & lotto", en: "Lottery & betting" },
          icon: "🎰",
          keywords: ["danske spil", "lotto", "tips", "oddset", "bet365", "unibet"],
        },
        {
          name: { da: "Babyudstyr", en: "Baby supplies" },
          icon: "👶",
          keywords: ["baby", "bleer", "pampers", "libero", "modermælk"],
        },
        {
          name: { da: "Kæledyr", en: "Pets" },
          icon: "🐾",
          keywords: ["dyrlæge", "petworld", "zooplus", "kæledyr", "hundefoder", "royal canin"],
        },
        {
          name: { da: "Gaver & velgørenhed", en: "Gifts & charity" },
          icon: "🎁",
          keywords: ["gave", "velgørenhed", "donation", "røde kors", "kræftens bekæmpelse", "børnefonden", "unicef"],
        },
        {
          name: { da: "Tobak & alkohol", en: "Tobacco & alcohol" },
          icon: "🍺",
          keywords: ["tobak", "cigaret", "vin", "øl", "spiritus", "carlsberg", "vinspecialisten", "skjold burne"],
        },
        {
          name: { da: "Kontanthævning & check", en: "Cash withdrawal & check" },
          icon: "💵",
          keywords: ["hævning", "kontant", "atm", "check"],
        },
        {
          name: { da: "Højskole- & kursusophold", en: "Folk high school & courses" },
          icon: "🏫",
          keywords: ["højskole", "kursus", "kursusophold", "efterskole"],
        },
        {
          name: { da: "Serviceydelser & rådgivning", en: "Services & consulting" },
          icon: "💼",
          keywords: ["advokat", "revisor", "rådgivning", "konsulent"],
        },
        {
          name: { da: "Andet", en: "Other" },
          icon: "📦",
        },
      ],
    },
    {
      name: { da: "Ferie", en: "Vacation" },
      icon: "🏖️",
      keywords: [],
      children: [
        {
          name: { da: "Fly", en: "Flights" },
          icon: "✈️",
          keywords: ["fly", "sas", "norwegian", "ryanair", "klm", "lufthansa", "easyjet", "momondo", "travellink", "flybillet"],
        },
        {
          name: { da: "Hotel", en: "Hotel" },
          icon: "🏨",
          keywords: ["hotel", "booking.com", "hotels.com", "airbnb", "expedia"],
        },
        {
          name: { da: "Billeje", en: "Car rental" },
          icon: "🚙",
          keywords: ["billeje", "hertz", "avis", "europcar", "sixt", "enterprise", "biludlejning"],
        },
        {
          name: { da: "Sommerhus & camping", en: "Summer house & camping" },
          icon: "🏕️",
          keywords: ["sommerhus", "camping", "dancenter", "novasol", "feriepartner"],
        },
        {
          name: { da: "Ferieaktiviteter", en: "Vacation activities" },
          icon: "🎢",
          keywords: ["aktivitet", "udflugt", "entre", "oplevelse", "tivoli"],
        },
        {
          name: { da: "Rejseforsikring", en: "Travel insurance" },
          icon: "🧳",
          keywords: ["rejseforsikring", "gouda", "europæiske"],
        },
        {
          name: { da: "Andet", en: "Other" },
          icon: "📦",
        },
      ],
    },
    {
      name: { da: "Diverse", en: "Miscellaneous" },
      icon: "🗑️",
      keywords: [],
      children: [
        {
          name: { da: "Bankgebyrer", en: "Bank fees" },
          icon: "🏦",
          keywords: ["gebyr", "bankgebyr", "årsgebyr", "kortgebyr"],
        },
        {
          name: { da: "Rykkergebyrer", en: "Reminder fees" },
          icon: "⚠️",
          keywords: ["rykker", "rykkergebyr", "påmindelse", "inkasso"],
        },
        {
          name: { da: "Bøder & afgifter", en: "Fines & fees" },
          icon: "🚓",
          keywords: ["bøde", "fartbøde", "p-bøde", "kontrolafgift", "politi"],
        },
        {
          name: { da: "Restskat", en: "Tax arrears" },
          icon: "📋",
          keywords: ["restskat", "skattestyrelsen", "skat.dk"],
        },
        {
          name: { da: "Andet", en: "Other" },
          icon: "📦",
        },
      ],
    },
    {
      name: { da: "Lån & gæld", en: "Loans & debt" },
      icon: "🔒",
      keywords: [],
      children: [
        {
          name: { da: "Studielån", en: "Student loan" },
          icon: "🎓",
          keywords: ["su-lån", "studielån", "udbetaling danmark"],
        },
        {
          name: { da: "Forbrugslån", en: "Consumer loan" },
          icon: "💳",
          keywords: ["forbrugslån", "lendo", "basisbank", "ekspres bank", "santander consumer"],
        },
        {
          name: { da: "Privat lån", en: "Private loan" },
          icon: "🤝",
          keywords: ["privat lån", "familielån"],
        },
        {
          name: { da: "Udlånsrenter", en: "Loan interest" },
          icon: "📈",
          keywords: ["rente", "udlånsrente", "lånerente"],
        },
      ],
    },
    {
      name: { da: "Pension & opsparing", en: "Pension & savings" },
      icon: "🏦",
      keywords: [],
      children: [
        {
          name: { da: "Pensionsopsparing", en: "Pension savings" },
          icon: "👴",
          keywords: ["pension", "pfa", "velliv", "danica", "sampension", "industriens pension", "akademikerpension", "atp"],
        },
        {
          name: { da: "Børneopsparing", en: "Child savings" },
          icon: "🧒",
          keywords: ["børneopsparing", "børnebonus"],
        },
        {
          name: { da: "Værdipapirer", en: "Securities" },
          icon: "📊",
          keywords: ["aktier", "obligationer", "investering", "saxo bank", "nordnet", "etoro", "depot"],
        },
        {
          name: { da: "Andet", en: "Other" },
          icon: "📦",
        },
      ],
    },
  ],
  income: [
    {
      name: { da: "Indkomst", en: "Income" },
      icon: "💰",
      keywords: [],
      children: [
        {
          name: { da: "Løn", en: "Salary" },
          icon: "💼",
          keywords: ["løn", "gage", "månedsløn", "salary"],
        },
        {
          name: { da: "Pensionsudbetaling", en: "Pension payout" },
          icon: "👴",
          keywords: ["pension", "pensionsudbetaling", "folkepension", "atp livslang"],
        },
        {
          name: { da: "Overførselsindkomst", en: "Transfer income" },
          icon: "🏛️",
          keywords: ["kontanthjælp", "dagpenge", "sygedagpenge", "udbetaling danmark"],
        },
        {
          name: { da: "SU", en: "SU" },
          icon: "🎓",
          keywords: ["su", "statens uddannelsesstøtte"],
        },
        {
          name: { da: "Børnepenge", en: "Child benefits" },
          icon: "👶",
          keywords: ["børnepenge", "børnecheck", "børne- og ungeydelse", "børneydelse"],
        },
        {
          name: { da: "Feriepenge", en: "Holiday pay" },
          icon: "🏖️",
          keywords: ["feriepenge", "feriekonto", "feriepengeinfo"],
        },
        {
          name: { da: "Renteindtægter", en: "Interest income" },
          icon: "💹",
          keywords: ["rente", "renteindtægt", "tilgodehavende rente"],
        },
        {
          name: { da: "Udbytte & afkast", en: "Dividends & returns" },
          icon: "📈",
          keywords: ["udbytte", "afkast", "dividend", "aktieudbytte"],
        },
        {
          name: { da: "Overskydende skat", en: "Tax refund" },
          icon: "💰",
          keywords: ["overskydende skat", "skatterefusion", "årsopgørelse"],
        },
        {
          name: { da: "Boligstøtte", en: "Housing benefit" },
          icon: "🏠",
          keywords: ["boligstøtte", "boligsikring", "boligydelse"],
        },
        {
          name: { da: "Andet", en: "Other" },
          icon: "📦",
        },
      ],
    },
  ],
};
