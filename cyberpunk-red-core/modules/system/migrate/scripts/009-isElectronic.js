/* eslint-disable foundry-cpr/logger-after-function-definition */

import CPRMigration from "../cpr-migration.js";
import CPRSystemUtils from "../../../utils/cpr-systemUtils.js";
import LOGGER from "../../../utils/cpr-logger.js";

const ELECTRONIC_GEAR = [
  "Agent",
  "Agente",
  "Amplificador de bolsillo",
  "Amplificador de bolso",
  "Amplificateur portable",
  "Amplificatore Tascabile",
  "Analisador Químico",
  "Analizador Químico",
  "Analizator biochemiczny",
  "Analizzatore Chimico",
  "Analyseur chimique",
  "Armazón Lineal ∑ (Sigma)",
  "Armazón Lineal β (beta)",
  "Audio Recorder",
  "Audiorekorder",
  "Auto Level Dampening Ear Protectors",
  "Automatische Lärmdämmung",
  "Automatyczne słuchawki wygłuszające",
  "Auto Nivelador de Audição",
  " Balise pour traceur",
  "Braindance Viewer",
  "Braindance-Viewer",
  "Brouilleur/décrypteur",
  "Bug Detector",
  "Cámara de Video",
  "Caméra",
  "Câmera de Vídeo",
  "Cellulare Usa-e-Getta",
  "Charpente linéaire Beta",
  "Charpente linéaire Sigma",
  "Chemical Analyzer",
  "Chemisches Analysegerät",
  "Chip de Memoria",
  "Chip de Memória",
  "Chip di memoria",
  "Chitarra Elettrica/Altro Strumento",
  "Cifrador/Descifrador",
  "Codificatore/Decodificatore",
  "Communicateur radio",
  "Computador",
  "Computadora",
  "Computer",
  "Comunicador de Radio",
  "Comunicador de Rádio",
  "Comunicatore Radio",
  "Criopompa",
  "Crioserbatoio",
  "Criotank",
  "Cryocuve",
  "Cryopompe",
  "Cryopump",
  "Cryopumpe",
  "Cryotank",
  "Czip pamięci",
  "Détecteur de micros",
  "Détecteur de radar",
  "Detector de bugs",
  "Detector de Micrófonos",
  "Detector de radar",
  "Detector de Radar",
  "Disposable Cell Phone",
  "Dispositivo de Rastreo",
  "Dispositivo rastreador",
  "Drum Synthesizer",
  "Electric Guitar/Other Instrument",
  "Elektrische Gitarre/Anderes Instrument",
  "Embaralhamento/Descrambler",
  "Enregistreur audio",
  "Escáner Médico",
  "Flashlight",
  "Funk­kom­munikator",
  "Gafas de Virtualidad",
  "Gitara elektryczna/inny instrument",
  "Gogle wirtualowe",
  "Grabadora de Audio",
  "Gravador de Áudio",
  "Guitare Électrique/Autre Instrument",
  "Guitarra Eléctrica / Otros Instrumentos",
  "Guitarra/Outros Instrumentos",
  "Homing Tracer",
  "Jednorazowy telefon komórkowy",
  "Kamera wideo",
  "Koder/dekoder",
  "Komputer",
  "Kriopompa",
  "Kriozbiornik",
  "Lampe-torche",
  "Lanterna",
  "Latarka",
  "Lecteur de danse sensorielle",
  "Linear Frame ∑ (Sigma)",
  "Linear Frame β (Beta)",
  "Lineartragwerk (Sigma)",
  "Lineartragwerk β (Beta)",
  "Linterna",
  "Localizzatore",
  "Lunettes de réalité virtuelle",
  "MediScanner",
  "Médiscanner",
  "Medscanner",
  "Memory Chip",
  "Mini Rastreador",
  "Moldura linear &(Beta)",
  "Nadajnik lokalizatora",
  "Óculos de Virtualidade",
  "Odbiornik lokalizatora",
  "Ordinateur",
  "Pad de percussion électronique",
  "Peilsender",
  "Peilsucher",
  "Pocket Amplifier",
  "Protection auditive active",
  "Protectores auditivos de nivel automático",
  "Protezione Auricolare Autolivellante",
  "Przeglądarka braindance'u",
  "Puce Mémoire",
  "Quadro Linear ( (Sigma)",
  "Radar com Rastreador",
  "Radar Detector",
  "Radar­ detektor",
  "Radio Communicator",
  "Radiokomunikator",
  "Ramownica linearna ∑ (Sigma)",
  "Ramownica linearna β (Beta)",
  "Registratore Audio",
  "Rejestrator dźwięku",
  "Representante",
  "Rilevatore di Cimici",
  "Rivelatore Radar",
  "Scanner",
  "Scrambler/Descrambler",
  "Sintetizador de tambor",
  "Sintetizzatore di Percussioni",
  "Sistema Criogénico",
  "Skaner medyczny",
  "Störer/Entstörer",
  "Syntezator perkusyjny",
  "Synth-Schlagzeug",
  "Tanque Criogénico",
  "Taschenlampe",
  "Taschenverstärker",
  "Tech Scanner",
  "Telaio Lineare ∑ (Sigma)",
  "Telaio Lineare β (Beta)",
  "Telefone celular descartável",
  "Teléfono móvil desechable",
  "Téléphone jetable",
  "Torcia Elettrica",
  "Tracciatore",
  "Tracer Button",
  "Traceur",
  "Videocamera",
  "Video Camera",
  "Videokamera",
  "Virtuality-Brille",
  "Virtuality Goggles",
  "Visor de Braindance",
  "Visore Braindance",
  "Visore Virtuality",
  "Visualizador de Neuro Dança",
  "Wanzen­­finder",
  "Wegwerfhandy",
  "Wykrywacz podsłuchu",
  "Wykrywacz radaru",
  "Wzmacniacz kieszonkowy",
  "Агент",
  "Активные наушники",
  "Видеокамера",
  "Диктофон",
  "Драм-машина",
  "Карманный усилитель",
  "Кнопка отслеживания",
  "Компьютер",
  "Криокапсула",
  "Криопомпа",
  "Линейная рама β (Бета)",
  "Линейная рама ∑ (Сигма)",
  "Медсканер",
  "Обнаружитель жучков",
  "Одноразовая мобила",
  "Очки виртуальности",
  "Просмоторщик брейндансов",
  "Радиокоммуникатор",
  "Система обнаружения излучения",
  "Скремблер/Дескремблер",
  "Трассировщик",
  "Фонарик",
  "Химический анализатор",
  "Щепка для данных",
  "Электрогитара/иной инструмент",
];

const ELECTRONIC_UPGRADES = [
  "Backup Drive",
  "Bariera przeciwKRASHowa",
  "Barreira KRASH",
  "Barrera KRASH",
  "Barriera KRASH",
  "Barrière anti-KRASH",
  "Blocco DNA",
  "Bloqueo de ADN",
  "Collegamento Smartgun",
  "Copia de seguridad",
  "Datensicherungslaufwerk",
  "Disco di Backup",
  "Disque dur de sauvegarde",
  "DNA Lock",
  "DNS-Schloss",
  "Enlace de Smartgun",
  "Extension de portée",
  "Fechadura de DNA",
  "Infared Nightvison Scope",
  "KRASH Barrier",
  "KRASH-Barriere",
  "Liaison smartgun",
  "Link Smartgun",
  "Mejora de distancia",
  "Melhoria de Alcance",
  "Portata Migliorata",
  "Range Upgrade",
  "Reichweitenverbesserung",
  "Smartgun Link",
  "Smartgun-Verbindung",
  "Ulepszenie zasięgu",
  "Unidade de backup",
  "Verrou biométrique",
  "Zamek DNA",
  "Zapasowy dysk",
  "Złącze Smartguna",
  "Барьер KRASH",
  "Блокировка на ДНК",
  "Диск с бэкапом",
  "Смартлинк",
  "Улучшение дальности",
];

const PROVIDES_HARDENING = [
  "Abschirmung (Cyberbein)",
  "Abschirmung (Cyber­arm)",
  "Circuiti Rinforzati",
  "Circuito Endurecido",
  "Circuitos Endurecidos",
  "Circuits renforcés",
  "Escudo EMP (Cyberbrazo)",
  "Escudo EMP (Cyberpierna)",
  "Hardened Circuitry",
  "Hardened Circuitry",
  "Hardened Shielding (Cyber Arm)",
  "Hardened Shielding (Cyber Arm)",
  "Hardened Shielding (Cyber Leg)",
  "Hardened Shielding (Cyber Leg)",
  "Proteção Reforçada (Braço Ciber)",
  "Proteção Reforçada (Perna Ciber)",
  "Renforcement électronique (Cyberbras)",
  "Renforcement électronique (Cyberjambe)",
  "Schaltkreisabschirmung",
  "Schermatura Rinforzata (Cyberbraccio)",
  "Schermatura Rinforzata (Cybergamba)",
  "Wzmocniona osłona (Cybernoga)",
  "Wzmocniona osłona (Cyberręka)",
  "Wzmocnione obwody",
  "Защищённые схемы",
  "Усиленная защита (Кибернога)",
  "Усиленная защита (Киберрука)",
];

const CORE_CYBERWARE = [
  "Cyberfashion (7 emplacements d'extension)",
  "Cybermoda (7 gniazd na modyfikacje)",
  "Esterno (7 Slot Opzionali)",
  "External (7 Option Slots)",
  "Externe (7 Emplacements d'extension)",
  "Externo (7 Espacios de Opción)",
  "Fashionware (7 Espacios de Opción)",
  "Fashionware (7 Option Slots)",
  "Fashionware (7 Slot Opzionali)",
  "Internal (7 Option Slots)",
  "Interne (7 Emplacements d'extension)",
  "Interno (7 Espacios de Opción)",
  "Interno (7 Slot Opzionali)",
  "Wewnętrzne (7 gniazd na modyfikacje)",
  "Zewnętrzne (7 gniazd na modyfikacje)",
];

/**
 * An unreported feature was to add a means to distinguish electronic
 * from other items. This enables a little more control and automation
 * over situations where EMP grenades or damage is used.
 */
export default class ItemIsElectronicMigration extends CPRMigration {
  constructor() {
    LOGGER.trace("constructor | ItemIsElectronic Migration");
    super();
    this.version = 9;
    this.name = "ItemSecondaryWeapon Migration";
  }

  /**
   * Executed before the migration takes place, see run() in the base migration class.
   */
  async preMigrate() {
    LOGGER.trace(`preMigrate | ${this.version}-${this.name}`);
    CPRSystemUtils.DisplayMessage(
      "notify",
      CPRSystemUtils.Localize("CPR.migration.effects.beginMigration")
    );
    LOGGER.log(`Starting migration: ${this.name}`);
  }

  /**
   * Takes place after the data migration completes.
   */
  async postMigrate() {
    LOGGER.trace(`postMigrate | ${this.version}-${this.name}`);
    LOGGER.log(`Finishing migration: ${this.name}`);
  }

  /**
   * Here's the real work.
   *
   * @param {CPRItem} item
   */
  static async migrateItem(item) {
    LOGGER.trace(`migrateItem | ${this.version}-${this.name}`);

    // Electronic gear
    if (item.type === "gear") {
      const updateData = item.isOwned ? { _id: item._id } : {};
      if (ELECTRONIC_GEAR.includes(item.name)) {
        updateData["system.isElectronic"] = true;
      } else {
        updateData["system.isElectronic"] = false;
      }
      return item.isOwned ? updateData : item.update(updateData);
    }

    // Electronic Upgrades
    if (item.type === "itemUpgrade") {
      const updateData = item.isOwned ? { _id: item._id } : {};
      if (ELECTRONIC_UPGRADES.includes(item.name)) {
        updateData["system.isElectronic"] = true;
      } else {
        updateData["system.isElectronic"] = false;
      }
      if (PROVIDES_HARDENING.includes(item.name)) {
        updateData["system.providesHardening"] = true;
      } else {
        updateData["system.providesHardening"] = false;
      }
      return item.isOwned ? updateData : item.update(updateData);
    }

    // All cyberware/cyberdecks are electronic
    if (item.type === "cyberware" || item.type === "cyberdeck") {
      const updateData = item.isOwned ? { _id: item._id } : {};
      // Core cyberware is a system thing, not a "real" item
      if (CORE_CYBERWARE.includes(item.name)) {
        updateData["system.isElectronic"] = false;
      } else {
        updateData["system.isElectronic"] = true;
      }

      // Some Cyberware provided hardening, update those
      if (PROVIDES_HARDENING.includes(item.name)) {
        updateData["system.providesHardening"] = true;
      } else {
        updateData["system.providesHardening"] = false;
      }
      return item.isOwned ? updateData : item.update(updateData);
    }

    // Set all armor to not electronic as that's moset likely
    if (item.type === "armor") {
      const updateData = item.isOwned ? { _id: item._id } : {};
      updateData["system.isElectronic"] = false;
      return item.isOwned ? updateData : item.update(updateData);
    }

    return null;
  }

  /**
   * Simply make sure owned items are updated too.
   *
   * @param {CPRActor} actor
   */
  async migrateActor(actor) {
    LOGGER.trace(`migrateActor | ${this.version}-${this.name}`);
    const itemUpdates = [];
    for (const item of actor.items) {
      // eslint-disable-next-line no-await-in-loop
      const updateData = await ItemIsElectronicMigration.migrateItem(item);
      if (updateData !== null) itemUpdates.push(updateData);
    }
    return actor.updateEmbeddedDocuments("Item", itemUpdates);
  }
}
