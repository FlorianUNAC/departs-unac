// Référentiel des escales par zone, pour la saisie (trigramme -> ville) et le classement automatique.
// Modifiable librement : ajouter une ligne "CODE: 'Ville'" dans la bonne zone.
window.ESCALES = {
  LC: [
    { zone: "Afrique", escales: {
      ABJ: "Abidjan", ABV: "Abuja", ACC: "Accra", BKO: "Bamako", BZV: "Brazzaville", CKY: "Conakry",
      COO: "Cotonou", CPT: "Le Cap", DLA: "Douala", DSS: "Dakar", FIH: "Kinshasa", JNB: "Johannesburg",
      JRO: "Kilimandjaro", LAD: "Luanda", LBV: "Libreville", LFW: "Lomé", LOS: "Lagos", NBO: "Nairobi",
      NDJ: "N'Djamena", NIM: "Niamey", NKC: "Nouakchott", NSI: "Yaoundé", OUA: "Ouagadougou",
      PNR: "Pointe-Noire", SSG: "Malabo", ZNZ: "Zanzibar", ADD: "Addis-Abeba"
    }},
    { zone: "Moyen-Orient", escales: {
      BEY: "Beyrouth", CAI: "Le Caire", DXB: "Dubaï", JIB: "Djibouti", RUH: "Riyad", TLV: "Tel-Aviv",
      AMM: "Amman", DOH: "Doha", JED: "Djeddah", AUH: "Abou Dhabi"
    }},
    { zone: "Asie", escales: {
      BKK: "Bangkok", BLR: "Bangalore", BOM: "Bombay", DEL: "Delhi", HKG: "Hong Kong", HKT: "Phuket",
      HND: "Tokyo-Haneda", NRT: "Tokyo-Narita", KIX: "Osaka", ICN: "Séoul", MNL: "Manille", PEK: "Pékin",
      PVG: "Shanghai", SGN: "Hô Chi Minh-Ville", HAN: "Hanoï", SIN: "Singapour", TPE: "Taipei",
      KUL: "Kuala Lumpur", CGK: "Jakarta", MAA: "Chennai"
    }},
    { zone: "Amérique du Nord", escales: {
      ATL: "Atlanta", BOS: "Boston", DEN: "Denver", DFW: "Dallas", DTW: "Détroit", IAD: "Washington",
      IAH: "Houston", JFK: "New York-JFK", EWR: "Newark", LAS: "Las Vegas", LAX: "Los Angeles", MCO: "Orlando",
      MIA: "Miami", MSP: "Minneapolis", ORD: "Chicago", PHX: "Phoenix", RDU: "Raleigh-Durham", SEA: "Seattle",
      SFO: "San Francisco", YUL: "Montréal", YYZ: "Toronto", YVR: "Vancouver", YQB: "Québec"
    }},
    { zone: "Caraïbes, Océan Indien et Amérique du Sud", escales: {
      FDF: "Fort-de-France", PTP: "Pointe-à-Pitre", CAY: "Cayenne", PAP: "Port-au-Prince",
      SDQ: "Saint-Domingue", PUJ: "Punta Cana", HAV: "La Havane", SXM: "Saint-Martin", CUN: "Cancún",
      MEX: "Mexico", PTY: "Panama", SJO: "San José", BOG: "Bogota", LIM: "Lima", SCL: "Santiago",
      EZE: "Buenos Aires", GIG: "Rio de Janeiro", GRU: "São Paulo", FOR: "Fortaleza", MVD: "Montevideo",
      RUN: "La Réunion", MRU: "Maurice", TNR: "Antananarivo", SEZ: "Seychelles", MLE: "Malé"
    }}
  ],
  MC: [
    { zone: "France", escales: {
      AJA: "Ajaccio", BIA: "Bastia", BES: "Brest", BIQ: "Biarritz", BOD: "Bordeaux", CFE: "Clermont-Ferrand",
      LYS: "Lyon", MPL: "Montpellier", MRS: "Marseille", NCE: "Nice", NTE: "Nantes", PUF: "Pau",
      RNS: "Rennes", SXB: "Strasbourg", TLN: "Toulon", TLS: "Toulouse"
    }},
    { zone: "Europe du Nord", escales: {
      AMS: "Amsterdam", ARN: "Stockholm", BER: "Berlin", BHX: "Birmingham", BLL: "Billund", CPH: "Copenhague",
      DUB: "Dublin", DUS: "Düsseldorf", EDI: "Édimbourg", FRA: "Francfort", GOT: "Göteborg", HAJ: "Hanovre",
      HAM: "Hambourg", HEL: "Helsinki", LHR: "Londres-Heathrow", LGW: "Londres-Gatwick", MAN: "Manchester",
      MUC: "Munich", NCL: "Newcastle", OSL: "Oslo", STR: "Stuttgart", BRU: "Bruxelles", LUX: "Luxembourg"
    }},
    { zone: "Europe du Sud", escales: {
      AGP: "Malaga", ATH: "Athènes", BCN: "Barcelone", BLQ: "Bologne", CTA: "Catane", FCO: "Rome",
      FLR: "Florence", LIN: "Milan-Linate", MXP: "Milan-Malpensa", LIS: "Lisbonne", MAD: "Madrid",
      NAP: "Naples", OPO: "Porto", PMI: "Palma", SVQ: "Séville", TRN: "Turin", VCE: "Venise", VLC: "Valence",
      BIO: "Bilbao", PMO: "Palerme"
    }},
    { zone: "Europe centrale et de l'Est", escales: {
      BEG: "Belgrade", BSL: "Bâle-Mulhouse", BUD: "Budapest", GVA: "Genève", KRK: "Cracovie", LJU: "Ljubljana",
      OTP: "Bucarest", PRG: "Prague", SOF: "Sofia", VIE: "Vienne", WAW: "Varsovie", ZAG: "Zagreb",
      ZRH: "Zurich", IST: "Istanbul", TBS: "Tbilissi", EVN: "Erevan"
    }},
    { zone: "Afrique du Nord et Méditerranée", escales: {
      ALG: "Alger", ORN: "Oran", CMN: "Casablanca", RAK: "Marrakech", RBA: "Rabat", TNG: "Tanger",
      TUN: "Tunis", DJE: "Djerba", TLV: "Tel-Aviv", BEY: "Beyrouth", AMM: "Amman", LCA: "Larnaca"
    }}
  ]
};
