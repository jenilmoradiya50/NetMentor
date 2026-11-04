/**
 * Pre-configured catalog manifest of Jeremy's IT Lab CCNA (200-301) Flashcard Decks
 * and Packet Tracer Labs from https://github.com/stuff97/JeremyITLab-CCNA.
 *
 * NOTE: The actual binary files are NOT committed to this repository.
 * Files are streamed on-demand directly from the official upstream repository.
 */

export interface CatalogLab {
  id: string;
  day: number;
  filename: string;
  title: string;
  downloadUrl: string;
}

export interface CatalogDeck {
  id: string;
  day: number;
  filename: string;
  title: string;
  cleanTitle: string;
  category: string;
  downloadUrl: string;
  labs: CatalogLab[];
}

export const JEREMY_CCNA_DECKS: CatalogDeck[] = [
  {
    "id": "jeremy-day-01",
    "day": 1,
    "filename": "Day 01 Flashcards - Network Devices.apkg",
    "title": "Day 01 Flashcards - Network Devices.apkg",
    "cleanTitle": "Day 01 Network Devices",
    "category": "Network Fundamentals",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2001%20Flashcards%20-%20Network%20Devices.apkg",
    "labs": [
      {
        "id": "lab-day-01-packet-tracer-introduction",
        "day": 1,
        "filename": "Day 01 Lab - Packet Tracer Introduction.pkt",
        "title": "Day 01 Lab: Packet Tracer Introduction",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2001%20Lab%20-%20Packet%20Tracer%20Introduction.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-02",
    "day": 2,
    "filename": "Day 02 Flashcards - Interfaces and Cables.apkg",
    "title": "Day 02 Flashcards - Interfaces and Cables.apkg",
    "cleanTitle": "Day 02 Interfaces and Cables",
    "category": "Network Fundamentals",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2002%20Flashcards%20-%20Interfaces%20and%20Cables.apkg",
    "labs": [
      {
        "id": "lab-day-02-connecting-devices",
        "day": 2,
        "filename": "Day 02 Lab - Connecting Devices.pkt",
        "title": "Day 02 Lab: Connecting Devices",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2002%20Lab%20-%20Connecting%20Devices.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-03",
    "day": 3,
    "filename": "Day 03 Flashcards - OSI Model, TCP-IP Suite.apkg",
    "title": "Day 03 Flashcards - OSI Model, TCP-IP Suite.apkg",
    "cleanTitle": "Day 03 OSI Model, TCP-IP Suite",
    "category": "Network Fundamentals",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2003%20Flashcards%20-%20OSI%20Model,%20TCP-IP%20Suite.apkg",
    "labs": [
      {
        "id": "lab-day-03-osi-model",
        "day": 3,
        "filename": "Day 03 Lab - OSI Model.pkt",
        "title": "Day 03 Lab: OSI Model",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2003%20Lab%20-%20OSI%20Model.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-04",
    "day": 4,
    "filename": "Day 04 Flashcards - Intro to the CLI.apkg",
    "title": "Day 04 Flashcards - Intro to the CLI.apkg",
    "cleanTitle": "Day 04 Intro to the CLI",
    "category": "Network Fundamentals",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2004%20Flashcards%20-%20Intro%20to%20the%20CLI.apkg",
    "labs": [
      {
        "id": "lab-day-04-basic-device-security",
        "day": 4,
        "filename": "Day 04 Lab - Basic Device Security.pkt",
        "title": "Day 04 Lab: Basic Device Security",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2004%20Lab%20-%20Basic%20Device%20Security.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-05",
    "day": 5,
    "filename": "Day 05 Flashcards - Ethernet LAN Switching Part 1.apkg",
    "title": "Day 05 Flashcards - Ethernet LAN Switching Part 1.apkg",
    "cleanTitle": "Day 05 Ethernet LAN Switching Part 1",
    "category": "Network Access & Switching",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2005%20Flashcards%20-%20Ethernet%20LAN%20Switching%20Part%201.apkg",
    "labs": []
  },
  {
    "id": "jeremy-day-06",
    "day": 6,
    "filename": "Day 06 Flashcards - Ethernet LAN Switching Part 2.apkg",
    "title": "Day 06 Flashcards - Ethernet LAN Switching Part 2.apkg",
    "cleanTitle": "Day 06 Ethernet LAN Switching Part 2",
    "category": "Network Access & Switching",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2006%20Flashcards%20-%20Ethernet%20LAN%20Switching%20Part%202.apkg",
    "labs": [
      {
        "id": "lab-day-06-ethernet-lan-switching",
        "day": 6,
        "filename": "Day 06 Lab - Ethernet LAN Switching.pkt",
        "title": "Day 06 Lab: Ethernet LAN Switching",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2006%20Lab%20-%20Ethernet%20LAN%20Switching.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-07",
    "day": 7,
    "filename": "Day 07 Flashcards - IPv4 Addresses Part 1.apkg",
    "title": "Day 07 Flashcards - IPv4 Addresses Part 1.apkg",
    "cleanTitle": "Day 07 IPv4 Addresses Part 1",
    "category": "Network Access & Switching",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2007%20Flashcards%20-%20IPv4%20Addresses%20Part%201.apkg",
    "labs": []
  },
  {
    "id": "jeremy-day-08",
    "day": 8,
    "filename": "Day 08 Flashcards - IPv4 Addresses Part 2.apkg",
    "title": "Day 08 Flashcards - IPv4 Addresses Part 2.apkg",
    "cleanTitle": "Day 08 IPv4 Addresses Part 2",
    "category": "Network Access & Switching",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2008%20Flashcards%20-%20IPv4%20Addresses%20Part%202.apkg",
    "labs": [
      {
        "id": "lab-day-08-ipv4-addresses",
        "day": 8,
        "filename": "Day 08 Lab - IPv4 Addresses.pkt",
        "title": "Day 08 Lab: IPv4 Addresses",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2008%20Lab%20-%20IPv4%20Addresses.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-09",
    "day": 9,
    "filename": "Day 09 Flashcards - Switch Interfaces.apkg",
    "title": "Day 09 Flashcards - Switch Interfaces.apkg",
    "cleanTitle": "Day 09 Switch Interfaces",
    "category": "Network Access & Switching",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2009%20Flashcards%20-%20Switch%20Interfaces.apkg",
    "labs": [
      {
        "id": "lab-day-09-interface-configuration",
        "day": 9,
        "filename": "Day 09 Lab - Interface Configuration.pkt",
        "title": "Day 09 Lab: Interface Configuration",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2009%20Lab%20-%20Interface%20Configuration.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-10",
    "day": 10,
    "filename": "Day 10 Flashcards - IPv4 Header.apkg",
    "title": "Day 10 Flashcards - IPv4 Header.apkg",
    "cleanTitle": "Day 10 IPv4 Header",
    "category": "Network Fundamentals",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2010%20Flashcards%20-%20IPv4%20Header.apkg",
    "labs": []
  },
  {
    "id": "jeremy-day-11",
    "day": 11,
    "filename": "Day 11 Flashcards - Static Routing.apkg",
    "title": "Day 11 Flashcards - Static Routing.apkg",
    "cleanTitle": "Day 11 Static Routing",
    "category": "IP Connectivity & Routing",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2011%20Flashcards%20-%20Static%20Routing.apkg",
    "labs": [
      {
        "id": "lab-day-11-configuring-static-routes",
        "day": 11,
        "filename": "Day 11 Lab - Configuring Static Routes.pkt",
        "title": "Day 11 Lab: Configuring Static Routes",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2011%20Lab%20-%20Configuring%20Static%20Routes.pkt"
      },
      {
        "id": "lab-day-11-troubleshooting-static-routes",
        "day": 11,
        "filename": "Day 11 Lab - Troubleshooting Static Routes.pkt",
        "title": "Day 11 Lab: Troubleshooting Static Routes",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2011%20Lab%20-%20Troubleshooting%20Static%20Routes.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-13",
    "day": 13,
    "filename": "Day 13 Flashcards - Subnetting.apkg",
    "title": "Day 13 Flashcards - Subnetting.apkg",
    "cleanTitle": "Day 13 Subnetting",
    "category": "IP Connectivity & Routing",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2013%20Flashcards%20-%20Subnetting.apkg",
    "labs": []
  },
  {
    "id": "jeremy-day-16",
    "day": 16,
    "filename": "Day 16 Flashcards - VLANs Part 1.apkg",
    "title": "Day 16 Flashcards - VLANs Part 1.apkg",
    "cleanTitle": "Day 16 VLANs Part 1",
    "category": "Network Access & Switching",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2016%20Flashcards%20-%20VLANs%20Part%201.apkg",
    "labs": [
      {
        "id": "lab-day-16-vlans-part-1",
        "day": 16,
        "filename": "Day 16 Lab - VLANs Part 1.pkt",
        "title": "Day 16 Lab: VLANs Part 1",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2016%20Lab%20-%20VLANs%20Part%201.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-17",
    "day": 17,
    "filename": "Day 17 Flashcards - VLANs Part 2.apkg",
    "title": "Day 17 Flashcards - VLANs Part 2.apkg",
    "cleanTitle": "Day 17 VLANs Part 2",
    "category": "Network Access & Switching",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2017%20Flashcards%20-%20VLANs%20Part%202.apkg",
    "labs": [
      {
        "id": "lab-day-17-vlans-part-2",
        "day": 17,
        "filename": "Day 17 Lab - VLANs Part 2.pkt",
        "title": "Day 17 Lab: VLANs Part 2",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2017%20Lab%20-%20VLANs%20Part%202.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-18",
    "day": 18,
    "filename": "Day 18 Flashcards - VLANs Part 3.apkg",
    "title": "Day 18 Flashcards - VLANs Part 3.apkg",
    "cleanTitle": "Day 18 VLANs Part 3",
    "category": "Network Access & Switching",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2018%20Flashcards%20-%20VLANs%20Part%203.apkg",
    "labs": [
      {
        "id": "lab-day-18-multilayer-switching",
        "day": 18,
        "filename": "Day 18 Lab - Multilayer Switching.pkt",
        "title": "Day 18 Lab: Multilayer Switching",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2018%20Lab%20-%20Multilayer%20Switching.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-19",
    "day": 19,
    "filename": "Day 19 Flashcards - DTP-VTP.apkg",
    "title": "Day 19 Flashcards - DTP-VTP.apkg",
    "cleanTitle": "Day 19 DTP-VTP",
    "category": "Network Access & Switching",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2019%20Flashcards%20-%20DTP-VTP.apkg",
    "labs": [
      {
        "id": "lab-day-19-dtp-vtp",
        "day": 19,
        "filename": "Day 19 Lab - DTP-VTP.pkt",
        "title": "Day 19 Lab: DTP-VTP",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2019%20Lab%20-%20DTP-VTP.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-20",
    "day": 20,
    "filename": "Day 20 Flashcards - STP Part 1.apkg",
    "title": "Day 20 Flashcards - STP Part 1.apkg",
    "cleanTitle": "Day 20 STP Part 1",
    "category": "Network Access & Switching",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2020%20Flashcards%20-%20STP%20Part%201.apkg",
    "labs": [
      {
        "id": "lab-day-20-analyzing-stp",
        "day": 20,
        "filename": "Day 20 Lab - Analyzing STP.pkt",
        "title": "Day 20 Lab: Analyzing STP",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2020%20Lab%20-%20Analyzing%20STP.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-21",
    "day": 21,
    "filename": "Day 21 Flashcards - STP Part 2.apkg",
    "title": "Day 21 Flashcards - STP Part 2.apkg",
    "cleanTitle": "Day 21 STP Part 2",
    "category": "Network Access & Switching",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2021%20Flashcards%20-%20STP%20Part%202.apkg",
    "labs": [
      {
        "id": "lab-day-21-configuring-spanning-tree",
        "day": 21,
        "filename": "Day 21 Lab - Configuring Spanning Tree.pkt",
        "title": "Day 21 Lab: Configuring Spanning Tree",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2021%20Lab%20-%20Configuring%20Spanning%20Tree.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-22",
    "day": 22,
    "filename": "Day 22 Flashcards - Rapid STP.apkg",
    "title": "Day 22 Flashcards - Rapid STP.apkg",
    "cleanTitle": "Day 22 Rapid STP",
    "category": "Network Access & Switching",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2022%20Flashcards%20-%20Rapid%20STP.apkg",
    "labs": [
      {
        "id": "lab-day-22-rapid-stp",
        "day": 22,
        "filename": "Day 22 Lab - Rapid STP.pkt",
        "title": "Day 22 Lab: Rapid STP",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2022%20Lab%20-%20Rapid%20STP.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-23",
    "day": 23,
    "filename": "Day 23 Flashcards - EtherChannel.apkg",
    "title": "Day 23 Flashcards - EtherChannel.apkg",
    "cleanTitle": "Day 23 EtherChannel",
    "category": "Network Access & Switching",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2023%20Flashcards%20-%20EtherChannel.apkg",
    "labs": [
      {
        "id": "lab-day-23-etherchannel",
        "day": 23,
        "filename": "Day 23 Lab - EtherChannel.pkt",
        "title": "Day 23 Lab: EtherChannel",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2023%20Lab%20-%20EtherChannel.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-24",
    "day": 24,
    "filename": "Day 24 Flashcards - Dynamic Routing.apkg",
    "title": "Day 24 Flashcards - Dynamic Routing.apkg",
    "cleanTitle": "Day 24 Dynamic Routing",
    "category": "IP Connectivity & Routing",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2024%20Flashcards%20-%20Dynamic%20Routing.apkg",
    "labs": [
      {
        "id": "lab-day-24-floating-static-routes",
        "day": 24,
        "filename": "Day 24 Lab - Floating Static Routes.pkt",
        "title": "Day 24 Lab: Floating Static Routes",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2024%20Lab%20-%20Floating%20Static%20Routes.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-25",
    "day": 25,
    "filename": "Day 25 Flashcards - RIP & EIGRP.apkg",
    "title": "Day 25 Flashcards - RIP & EIGRP.apkg",
    "cleanTitle": "Day 25 RIP & EIGRP",
    "category": "IP Connectivity & Routing",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2025%20Flashcards%20-%20RIP%20%26%20EIGRP.apkg",
    "labs": [
      {
        "id": "lab-day-25-eigrp-configuration",
        "day": 25,
        "filename": "Day 25 Lab - EIGRP Configuration.pkt",
        "title": "Day 25 Lab: EIGRP Configuration",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2025%20Lab%20-%20EIGRP%20Configuration.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-25-extra",
    "day": 25,
    "filename": "Day 25 Lab - Extra Flashcards - EIGRP Terms.apkg",
    "title": "Day 25 Lab - Extra Flashcards - EIGRP Terms.apkg",
    "cleanTitle": "Day 25 Lab - Extra EIGRP Terms",
    "category": "IP Connectivity & Routing",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2025%20Lab%20-%20Extra%20Flashcards%20-%20EIGRP%20Terms.apkg",
    "labs": [
      {
        "id": "lab-day-25-eigrp-configuration",
        "day": 25,
        "filename": "Day 25 Lab - EIGRP Configuration.pkt",
        "title": "Day 25 Lab: EIGRP Configuration",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2025%20Lab%20-%20EIGRP%20Configuration.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-26",
    "day": 26,
    "filename": "Day 26 Flashcards - OSPF Part 1.apkg",
    "title": "Day 26 Flashcards - OSPF Part 1.apkg",
    "cleanTitle": "Day 26 OSPF Part 1",
    "category": "IP Connectivity & Routing",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2026%20Flashcards%20-%20OSPF%20Part%201.apkg",
    "labs": [
      {
        "id": "lab-day-26-ospf-part-1",
        "day": 26,
        "filename": "Day 26 Lab - OSPF Part 1.pkt",
        "title": "Day 26 Lab: OSPF Part 1",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2026%20Lab%20-%20OSPF%20Part%201.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-27",
    "day": 27,
    "filename": "Day 27 Flashcards - OSPF Part 2.apkg",
    "title": "Day 27 Flashcards - OSPF Part 2.apkg",
    "cleanTitle": "Day 27 OSPF Part 2",
    "category": "IP Connectivity & Routing",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2027%20Flashcards%20-%20OSPF%20Part%202.apkg",
    "labs": [
      {
        "id": "lab-day-27-ospf-part-2",
        "day": 27,
        "filename": "Day 27 Lab - OSPF Part 2.pkt",
        "title": "Day 27 Lab: OSPF Part 2",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2027%20Lab%20-%20OSPF%20Part%202.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-28",
    "day": 28,
    "filename": "Day 28 Flashcards - OSPF Part 3.apkg",
    "title": "Day 28 Flashcards - OSPF Part 3.apkg",
    "cleanTitle": "Day 28 OSPF Part 3",
    "category": "IP Connectivity & Routing",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2028%20Flashcards%20-%20OSPF%20Part%203.apkg",
    "labs": [
      {
        "id": "lab-day-28-ospf-part-3",
        "day": 28,
        "filename": "Day 28 Lab - OSPF Part 3.pkt",
        "title": "Day 28 Lab: OSPF Part 3",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2028%20Lab%20-%20OSPF%20Part%203.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-29",
    "day": 29,
    "filename": "Day 29 Flashcards - FHRPs.apkg",
    "title": "Day 29 Flashcards - FHRPs.apkg",
    "cleanTitle": "Day 29 FHRPs",
    "category": "IP Services & Operations",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2029%20Flashcards%20-%20FHRPs.apkg",
    "labs": [
      {
        "id": "lab-day-29-hsrp-configuration",
        "day": 29,
        "filename": "Day 29 Lab - HSRP Configuration.pkt",
        "title": "Day 29 Lab: HSRP Configuration",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2029%20Lab%20-%20HSRP%20Configuration.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-30",
    "day": 30,
    "filename": "Day 30 Flashcards - TCP & UDP.apkg",
    "title": "Day 30 Flashcards - TCP & UDP.apkg",
    "cleanTitle": "Day 30 TCP & UDP",
    "category": "IP Services & Operations",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2030%20Flashcards%20-%20TCP%20%26%20UDP.apkg",
    "labs": []
  },
  {
    "id": "jeremy-day-31",
    "day": 31,
    "filename": "Day 31 Flashcards - IPv6 Part 1.apkg",
    "title": "Day 31 Flashcards - IPv6 Part 1.apkg",
    "cleanTitle": "Day 31 IPv6 Part 1",
    "category": "Network Fundamentals",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2031%20Flashcards%20-%20IPv6%20Part%201.apkg",
    "labs": [
      {
        "id": "lab-day-31-ipv6-configuration-part-1",
        "day": 31,
        "filename": "Day 31 Lab - IPv6 Configuration Part 1.pkt",
        "title": "Day 31 Lab: IPv6 Configuration Part 1",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2031%20Lab%20-%20IPv6%20Configuration%20Part%201.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-32",
    "day": 32,
    "filename": "Day 32 Flashcards - IPv6 (Part 2).apkg",
    "title": "Day 32 Flashcards - IPv6 (Part 2).apkg",
    "cleanTitle": "Day 32 IPv6 (Part 2)",
    "category": "Network Fundamentals",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2032%20Flashcards%20-%20IPv6%20%28Part%202%29.apkg",
    "labs": [
      {
        "id": "lab-day-32-ipv6-configuration-part-2",
        "day": 32,
        "filename": "Day 32 Lab - IPv6 Configuration Part 2.pkt",
        "title": "Day 32 Lab: IPv6 Configuration Part 2",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2032%20Lab%20-%20IPv6%20Configuration%20Part%202.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-33",
    "day": 33,
    "filename": "Day 33 Flashcards - IPv6 (Part 3).apkg",
    "title": "Day 33 Flashcards - IPv6 (Part 3).apkg",
    "cleanTitle": "Day 33 IPv6 (Part 3)",
    "category": "Network Fundamentals",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2033%20Flashcards%20-%20IPv6%20%28Part%203%29.apkg",
    "labs": [
      {
        "id": "lab-day-33-ipv6-static-routes",
        "day": 33,
        "filename": "Day 33 Lab - IPv6 Static Routes.pkt",
        "title": "Day 33 Lab: IPv6 Static Routes",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2033%20Lab%20-%20IPv6%20Static%20Routes.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-34",
    "day": 34,
    "filename": "Day 34 Flashcards - Standard ACLs.apkg",
    "title": "Day 34 Flashcards - Standard ACLs.apkg",
    "cleanTitle": "Day 34 Standard ACLs",
    "category": "Network Fundamentals",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2034%20Flashcards%20-%20Standard%20ACLs.apkg",
    "labs": [
      {
        "id": "lab-day-34-standard-acls",
        "day": 34,
        "filename": "Day 34 Lab - Standard ACLs.pkt",
        "title": "Day 34 Lab: Standard ACLs",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2034%20Lab%20-%20Standard%20ACLs.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-35",
    "day": 35,
    "filename": "Day 35 Flashcards - Extended ACLs.apkg",
    "title": "Day 35 Flashcards - Extended ACLs.apkg",
    "cleanTitle": "Day 35 Extended ACLs",
    "category": "Network Fundamentals",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2035%20Flashcards%20-%20Extended%20ACLs.apkg",
    "labs": [
      {
        "id": "lab-day-35-extended-acls",
        "day": 35,
        "filename": "Day 35 Lab - Extended ACLs.pkt",
        "title": "Day 35 Lab: Extended ACLs",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2035%20Lab%20-%20Extended%20ACLs.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-36",
    "day": 36,
    "filename": "Day 36 Flashcards - CDP & LLDP.apkg",
    "title": "Day 36 Flashcards - CDP & LLDP.apkg",
    "cleanTitle": "Day 36 CDP & LLDP",
    "category": "IP Services & Operations",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2036%20Flashcards%20-%20CDP%20%26%20LLDP.apkg",
    "labs": [
      {
        "id": "lab-day-36-cdp---lldp",
        "day": 36,
        "filename": "Day 36 Lab - CDP & LLDP.pkt",
        "title": "Day 36 Lab: CDP & LLDP",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2036%20Lab%20-%20CDP%20%26%20LLDP.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-37",
    "day": 37,
    "filename": "Day 37 Flashcards - NTP.apkg",
    "title": "Day 37 Flashcards - NTP.apkg",
    "cleanTitle": "Day 37 NTP",
    "category": "IP Services & Operations",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2037%20Flashcards%20-%20NTP.apkg",
    "labs": [
      {
        "id": "lab-day-37-ntp",
        "day": 37,
        "filename": "Day 37 Lab - NTP.pkt",
        "title": "Day 37 Lab: NTP",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2037%20Lab%20-%20NTP.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-38",
    "day": 38,
    "filename": "Day 38 Flashcards - DNS.apkg",
    "title": "Day 38 Flashcards - DNS.apkg",
    "cleanTitle": "Day 38 DNS",
    "category": "IP Services & Operations",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2038%20Flashcards%20-%20DNS.apkg",
    "labs": [
      {
        "id": "lab-day-38-dns",
        "day": 38,
        "filename": "Day 38 Lab - DNS.pkt",
        "title": "Day 38 Lab: DNS",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2038%20Lab%20-%20DNS.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-39",
    "day": 39,
    "filename": "Day 39 Flashcards - DHCP.apkg",
    "title": "Day 39 Flashcards - DHCP.apkg",
    "cleanTitle": "Day 39 DHCP",
    "category": "IP Services & Operations",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2039%20Flashcards%20-%20DHCP.apkg",
    "labs": [
      {
        "id": "lab-day-39-dhcp",
        "day": 39,
        "filename": "Day 39 Lab - DHCP.pkt",
        "title": "Day 39 Lab: DHCP",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2039%20Lab%20-%20DHCP.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-40",
    "day": 40,
    "filename": "Day 40 Flashcards - SNMP.apkg",
    "title": "Day 40 Flashcards - SNMP.apkg",
    "cleanTitle": "Day 40 SNMP",
    "category": "IP Services & Operations",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2040%20Flashcards%20-%20SNMP.apkg",
    "labs": [
      {
        "id": "lab-day-40-snmp",
        "day": 40,
        "filename": "Day 40 Lab - SNMP.pkt",
        "title": "Day 40 Lab: SNMP",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2040%20Lab%20-%20SNMP.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-41",
    "day": 41,
    "filename": "Day 41 Flashcards - Syslog.apkg",
    "title": "Day 41 Flashcards - Syslog.apkg",
    "cleanTitle": "Day 41 Syslog",
    "category": "IP Services & Operations",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2041%20Flashcards%20-%20Syslog.apkg",
    "labs": [
      {
        "id": "lab-day-41-syslog",
        "day": 41,
        "filename": "Day 41 Lab - Syslog.pkt",
        "title": "Day 41 Lab: Syslog",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2041%20Lab%20-%20Syslog.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-42",
    "day": 42,
    "filename": "Day 42 Flashcards - SSH.apkg",
    "title": "Day 42 Flashcards - SSH.apkg",
    "cleanTitle": "Day 42 SSH",
    "category": "IP Services & Operations",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2042%20Flashcards%20-%20SSH.apkg",
    "labs": [
      {
        "id": "lab-day-42-ssh",
        "day": 42,
        "filename": "Day 42 Lab - SSH.pkt",
        "title": "Day 42 Lab: SSH",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2042%20Lab%20-%20SSH.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-43",
    "day": 43,
    "filename": "Day 43 Flashcards - FTP&TFTP.apkg",
    "title": "Day 43 Flashcards - FTP&TFTP.apkg",
    "cleanTitle": "Day 43 FTP&TFTP",
    "category": "IP Services & Operations",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2043%20Flashcards%20-%20FTP%26TFTP.apkg",
    "labs": [
      {
        "id": "lab-day-43-ftp---tftp",
        "day": 43,
        "filename": "Day 43 Lab - FTP & TFTP.pkt",
        "title": "Day 43 Lab: FTP & TFTP",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2043%20Lab%20-%20FTP%20%26%20TFTP.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-44",
    "day": 44,
    "filename": "Day 44 Flashcards - NAT (Part 1).apkg",
    "title": "Day 44 Flashcards - NAT (Part 1).apkg",
    "cleanTitle": "Day 44 NAT (Part 1)",
    "category": "IP Services & Operations",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2044%20Flashcards%20-%20NAT%20%28Part%201%29.apkg",
    "labs": [
      {
        "id": "lab-day-44-static-nat",
        "day": 44,
        "filename": "Day 44 Lab - Static NAT.pkt",
        "title": "Day 44 Lab: Static NAT",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2044%20Lab%20-%20Static%20NAT.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-45",
    "day": 45,
    "filename": "Day 45 Flashcards - NAT (Part 2).apkg",
    "title": "Day 45 Flashcards - NAT (Part 2).apkg",
    "cleanTitle": "Day 45 NAT (Part 2)",
    "category": "IP Services & Operations",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2045%20Flashcards%20-%20NAT%20%28Part%202%29.apkg",
    "labs": [
      {
        "id": "lab-day-45-dynamic-nat",
        "day": 45,
        "filename": "Day 45 Lab - Dynamic NAT.pkt",
        "title": "Day 45 Lab: Dynamic NAT",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2045%20Lab%20-%20Dynamic%20NAT.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-46",
    "day": 46,
    "filename": "Day 46 Flashcards - QoS (Part 1).apkg",
    "title": "Day 46 Flashcards - QoS (Part 1).apkg",
    "cleanTitle": "Day 46 QoS (Part 1)",
    "category": "Quality of Service (QoS)",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2046%20Flashcards%20-%20QoS%20%28Part%201%29.apkg",
    "labs": [
      {
        "id": "lab-day-46-voice-vlans",
        "day": 46,
        "filename": "Day 46 Lab - Voice VLANs.pkt",
        "title": "Day 46 Lab: Voice VLANs",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2046%20Lab%20-%20Voice%20VLANs.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-47",
    "day": 47,
    "filename": "Day 47 Flashcards - QoS (Part 2).apkg",
    "title": "Day 47 Flashcards - QoS (Part 2).apkg",
    "cleanTitle": "Day 47 QoS (Part 2)",
    "category": "Quality of Service (QoS)",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2047%20Flashcards%20-%20QoS%20%28Part%202%29.apkg",
    "labs": [
      {
        "id": "lab-day-47-qos",
        "day": 47,
        "filename": "Day 47 Lab - QoS.pkt",
        "title": "Day 47 Lab: QoS",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2047%20Lab%20-%20QoS.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-48",
    "day": 48,
    "filename": "Day 48 Flashcards - Security Fundamentals.apkg",
    "title": "Day 48 Flashcards - Security Fundamentals.apkg",
    "cleanTitle": "Day 48 Security Fundamentals",
    "category": "Security Fundamentals",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2048%20Flashcards%20-%20Security%20Fundamentals.apkg",
    "labs": []
  },
  {
    "id": "jeremy-day-49",
    "day": 49,
    "filename": "Day 49 Flashcards - Port Security.apkg",
    "title": "Day 49 Flashcards - Port Security.apkg",
    "cleanTitle": "Day 49 Port Security",
    "category": "Security Fundamentals",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2049%20Flashcards%20-%20Port%20Security.apkg",
    "labs": [
      {
        "id": "lab-day-49-port-security",
        "day": 49,
        "filename": "Day 49 Lab - Port Security.pkt",
        "title": "Day 49 Lab: Port Security",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2049%20Lab%20-%20Port%20Security.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-50",
    "day": 50,
    "filename": "Day 50 Flashcards - DHCP Snooping.apkg",
    "title": "Day 50 Flashcards - DHCP Snooping.apkg",
    "cleanTitle": "Day 50 DHCP Snooping",
    "category": "Security Fundamentals",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2050%20Flashcards%20-%20DHCP%20Snooping.apkg",
    "labs": [
      {
        "id": "lab-day-50-dhcp-snooping",
        "day": 50,
        "filename": "Day 50 Lab - DHCP Snooping.pkt",
        "title": "Day 50 Lab: DHCP Snooping",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2050%20Lab%20-%20DHCP%20Snooping.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-51",
    "day": 51,
    "filename": "Day 51 Flashcards - Dynamic ARP Inspection.apkg",
    "title": "Day 51 Flashcards - Dynamic ARP Inspection.apkg",
    "cleanTitle": "Day 51 Dynamic ARP Inspection",
    "category": "Security Fundamentals",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2051%20Flashcards%20-%20Dynamic%20ARP%20Inspection.apkg",
    "labs": [
      {
        "id": "lab-day-51-dynamic-arp-inspection",
        "day": 51,
        "filename": "Day 51 Lab - Dynamic ARP Inspection.pkt",
        "title": "Day 51 Lab: Dynamic ARP Inspection",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2051%20Lab%20-%20Dynamic%20ARP%20Inspection.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-52",
    "day": 52,
    "filename": "Day 52  Flashcards - LAN Architectures.apkg",
    "title": "Day 52  Flashcards - LAN Architectures.apkg",
    "cleanTitle": "Day 52  LAN Architectures",
    "category": "Network Architecture & Wireless",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2052%20%20Flashcards%20-%20LAN%20Architectures.apkg",
    "labs": [
      {
        "id": "lab-day-52-stp---hsrp-synchronization",
        "day": 52,
        "filename": "Day 52 Lab - STP & HSRP Synchronization.pkt",
        "title": "Day 52 Lab: STP & HSRP Synchronization",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2052%20Lab%20-%20STP%20%26%20HSRP%20Synchronization.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-53",
    "day": 53,
    "filename": "Day 53 Flashcards - WAN Architectures.apkg",
    "title": "Day 53 Flashcards - WAN Architectures.apkg",
    "cleanTitle": "Day 53 WAN Architectures",
    "category": "Network Architecture & Wireless",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2053%20Flashcards%20-%20WAN%20Architectures.apkg",
    "labs": [
      {
        "id": "lab-day-53-gre-tunnels",
        "day": 53,
        "filename": "Day 53 Lab - GRE Tunnels.pkt",
        "title": "Day 53 Lab: GRE Tunnels",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2053%20Lab%20-%20GRE%20Tunnels.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-54",
    "day": 54,
    "filename": "Day 54 Flashcards - Virtualization & Cloud.apkg",
    "title": "Day 54 Flashcards - Virtualization & Cloud.apkg",
    "cleanTitle": "Day 54 Virtualization & Cloud",
    "category": "Network Architecture & Wireless",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2054%20Flashcards%20-%20Virtualization%20%26%20Cloud.apkg",
    "labs": []
  },
  {
    "id": "jeremy-day-55",
    "day": 55,
    "filename": "Day 55 Flashcards - Wireless Fundamentals.apkg",
    "title": "Day 55 Flashcards - Wireless Fundamentals.apkg",
    "cleanTitle": "Day 55 Wireless Fundamentals",
    "category": "Network Architecture & Wireless",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2055%20Flashcards%20-%20Wireless%20Fundamentals.apkg",
    "labs": []
  },
  {
    "id": "jeremy-day-56",
    "day": 56,
    "filename": "Day 56 Flashcards - Wireless Architectures.apkg",
    "title": "Day 56 Flashcards - Wireless Architectures.apkg",
    "cleanTitle": "Day 56 Wireless Architectures",
    "category": "Network Architecture & Wireless",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2056%20Flashcards%20-%20Wireless%20Architectures.apkg",
    "labs": []
  },
  {
    "id": "jeremy-day-57",
    "day": 57,
    "filename": "Day 57 Flashcards - Wireless Security.apkg",
    "title": "Day 57 Flashcards - Wireless Security.apkg",
    "cleanTitle": "Day 57 Wireless Security",
    "category": "Security Fundamentals",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2057%20Flashcards%20-%20Wireless%20Security.apkg",
    "labs": []
  },
  {
    "id": "jeremy-day-58",
    "day": 58,
    "filename": "Day 58 Flashcards - Wireless Configuration.apkg",
    "title": "Day 58 Flashcards - Wireless Configuration.apkg",
    "cleanTitle": "Day 58 Wireless Configuration",
    "category": "Network Architecture & Wireless",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2058%20Flashcards%20-%20Wireless%20Configuration.apkg",
    "labs": [
      {
        "id": "lab-day-58-wireless-lans",
        "day": 58,
        "filename": "Day 58 Lab - Wireless LANs.pkt",
        "title": "Day 58 Lab: Wireless LANs",
        "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2058%20Lab%20-%20Wireless%20LANs.pkt"
      }
    ]
  },
  {
    "id": "jeremy-day-59",
    "day": 59,
    "filename": "Day 59 Flashcards - Network Automation.apkg",
    "title": "Day 59 Flashcards - Network Automation.apkg",
    "cleanTitle": "Day 59 Network Automation",
    "category": "Network Automation & Programmability",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2059%20Flashcards%20-%20Network%20Automation.apkg",
    "labs": []
  },
  {
    "id": "jeremy-day-60",
    "day": 60,
    "filename": "Day 60 Flashcards - JSON, XML, & YAML.apkg",
    "title": "Day 60 Flashcards - JSON, XML, & YAML.apkg",
    "cleanTitle": "Day 60 JSON, XML, & YAML",
    "category": "Network Automation & Programmability",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2060%20Flashcards%20-%20JSON,%20XML,%20%26%20YAML.apkg",
    "labs": []
  },
  {
    "id": "jeremy-day-61",
    "day": 61,
    "filename": "Day 61 Flashcards - REST APIs.apkg",
    "title": "Day 61 Flashcards - REST APIs.apkg",
    "cleanTitle": "Day 61 REST APIs",
    "category": "Network Automation & Programmability",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2061%20Flashcards%20-%20REST%20APIs.apkg",
    "labs": []
  },
  {
    "id": "jeremy-day-62",
    "day": 62,
    "filename": "Day 62 Flashcards - SDN.apkg",
    "title": "Day 62 Flashcards - SDN.apkg",
    "cleanTitle": "Day 62 SDN",
    "category": "Network Automation & Programmability",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2062%20Flashcards%20-%20SDN.apkg",
    "labs": []
  },
  {
    "id": "jeremy-day-63",
    "day": 63,
    "filename": "Day 63 Flashcards - Ansible, Puppet, Chef(1).apkg",
    "title": "Day 63 Flashcards - Ansible, Puppet, Chef(1).apkg",
    "cleanTitle": "Day 63 Ansible, Puppet, Chef(1)",
    "category": "Network Automation & Programmability",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/Anki-FlashCards/Day%2063%20Flashcards%20-%20Ansible,%20Puppet,%20Chef%281%29.apkg",
    "labs": []
  }
];

export const JEREMY_PACKET_TRACER_LABS: CatalogLab[] = [
  {
    "id": "lab-day-01-packet-tracer-introduction",
    "day": 1,
    "filename": "Day 01 Lab - Packet Tracer Introduction.pkt",
    "title": "Day 01 Lab: Packet Tracer Introduction",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2001%20Lab%20-%20Packet%20Tracer%20Introduction.pkt"
  },
  {
    "id": "lab-day-02-connecting-devices",
    "day": 2,
    "filename": "Day 02 Lab - Connecting Devices.pkt",
    "title": "Day 02 Lab: Connecting Devices",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2002%20Lab%20-%20Connecting%20Devices.pkt"
  },
  {
    "id": "lab-day-03-osi-model",
    "day": 3,
    "filename": "Day 03 Lab - OSI Model.pkt",
    "title": "Day 03 Lab: OSI Model",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2003%20Lab%20-%20OSI%20Model.pkt"
  },
  {
    "id": "lab-day-04-basic-device-security",
    "day": 4,
    "filename": "Day 04 Lab - Basic Device Security.pkt",
    "title": "Day 04 Lab: Basic Device Security",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2004%20Lab%20-%20Basic%20Device%20Security.pkt"
  },
  {
    "id": "lab-day-06-ethernet-lan-switching",
    "day": 6,
    "filename": "Day 06 Lab - Ethernet LAN Switching.pkt",
    "title": "Day 06 Lab: Ethernet LAN Switching",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2006%20Lab%20-%20Ethernet%20LAN%20Switching.pkt"
  },
  {
    "id": "lab-day-08-ipv4-addresses",
    "day": 8,
    "filename": "Day 08 Lab - IPv4 Addresses.pkt",
    "title": "Day 08 Lab: IPv4 Addresses",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2008%20Lab%20-%20IPv4%20Addresses.pkt"
  },
  {
    "id": "lab-day-09-interface-configuration",
    "day": 9,
    "filename": "Day 09 Lab - Interface Configuration.pkt",
    "title": "Day 09 Lab: Interface Configuration",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2009%20Lab%20-%20Interface%20Configuration.pkt"
  },
  {
    "id": "lab-day-11-configuring-static-routes",
    "day": 11,
    "filename": "Day 11 Lab - Configuring Static Routes.pkt",
    "title": "Day 11 Lab: Configuring Static Routes",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2011%20Lab%20-%20Configuring%20Static%20Routes.pkt"
  },
  {
    "id": "lab-day-11-troubleshooting-static-routes",
    "day": 11,
    "filename": "Day 11 Lab - Troubleshooting Static Routes.pkt",
    "title": "Day 11 Lab: Troubleshooting Static Routes",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2011%20Lab%20-%20Troubleshooting%20Static%20Routes.pkt"
  },
  {
    "id": "lab-day-12-life-of-a-packet",
    "day": 12,
    "filename": "Day 12 Lab - Life of a Packet.pkt",
    "title": "Day 12 Lab: Life of a Packet",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2012%20Lab%20-%20Life%20of%20a%20Packet.pkt"
  },
  {
    "id": "lab-day-15-vlsm",
    "day": 15,
    "filename": "Day 15 Lab - VLSM.pkt",
    "title": "Day 15 Lab: VLSM",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2015%20Lab%20-%20VLSM.pkt"
  },
  {
    "id": "lab-day-16-vlans-part-1",
    "day": 16,
    "filename": "Day 16 Lab - VLANs Part 1.pkt",
    "title": "Day 16 Lab: VLANs Part 1",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2016%20Lab%20-%20VLANs%20Part%201.pkt"
  },
  {
    "id": "lab-day-17-vlans-part-2",
    "day": 17,
    "filename": "Day 17 Lab - VLANs Part 2.pkt",
    "title": "Day 17 Lab: VLANs Part 2",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2017%20Lab%20-%20VLANs%20Part%202.pkt"
  },
  {
    "id": "lab-day-18-multilayer-switching",
    "day": 18,
    "filename": "Day 18 Lab - Multilayer Switching.pkt",
    "title": "Day 18 Lab: Multilayer Switching",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2018%20Lab%20-%20Multilayer%20Switching.pkt"
  },
  {
    "id": "lab-day-19-dtp-vtp",
    "day": 19,
    "filename": "Day 19 Lab - DTP-VTP.pkt",
    "title": "Day 19 Lab: DTP-VTP",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2019%20Lab%20-%20DTP-VTP.pkt"
  },
  {
    "id": "lab-day-20-analyzing-stp",
    "day": 20,
    "filename": "Day 20 Lab - Analyzing STP.pkt",
    "title": "Day 20 Lab: Analyzing STP",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2020%20Lab%20-%20Analyzing%20STP.pkt"
  },
  {
    "id": "lab-day-21-configuring-spanning-tree",
    "day": 21,
    "filename": "Day 21 Lab - Configuring Spanning Tree.pkt",
    "title": "Day 21 Lab: Configuring Spanning Tree",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2021%20Lab%20-%20Configuring%20Spanning%20Tree.pkt"
  },
  {
    "id": "lab-day-22-rapid-stp",
    "day": 22,
    "filename": "Day 22 Lab - Rapid STP.pkt",
    "title": "Day 22 Lab: Rapid STP",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2022%20Lab%20-%20Rapid%20STP.pkt"
  },
  {
    "id": "lab-day-23-etherchannel",
    "day": 23,
    "filename": "Day 23 Lab - EtherChannel.pkt",
    "title": "Day 23 Lab: EtherChannel",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2023%20Lab%20-%20EtherChannel.pkt"
  },
  {
    "id": "lab-day-24-floating-static-routes",
    "day": 24,
    "filename": "Day 24 Lab - Floating Static Routes.pkt",
    "title": "Day 24 Lab: Floating Static Routes",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2024%20Lab%20-%20Floating%20Static%20Routes.pkt"
  },
  {
    "id": "lab-day-25-eigrp-configuration",
    "day": 25,
    "filename": "Day 25 Lab - EIGRP Configuration.pkt",
    "title": "Day 25 Lab: EIGRP Configuration",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2025%20Lab%20-%20EIGRP%20Configuration.pkt"
  },
  {
    "id": "lab-day-26-ospf-part-1",
    "day": 26,
    "filename": "Day 26 Lab - OSPF Part 1.pkt",
    "title": "Day 26 Lab: OSPF Part 1",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2026%20Lab%20-%20OSPF%20Part%201.pkt"
  },
  {
    "id": "lab-day-27-ospf-part-2",
    "day": 27,
    "filename": "Day 27 Lab - OSPF Part 2.pkt",
    "title": "Day 27 Lab: OSPF Part 2",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2027%20Lab%20-%20OSPF%20Part%202.pkt"
  },
  {
    "id": "lab-day-28-ospf-part-3",
    "day": 28,
    "filename": "Day 28 Lab - OSPF Part 3.pkt",
    "title": "Day 28 Lab: OSPF Part 3",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2028%20Lab%20-%20OSPF%20Part%203.pkt"
  },
  {
    "id": "lab-day-29-hsrp-configuration",
    "day": 29,
    "filename": "Day 29 Lab - HSRP Configuration.pkt",
    "title": "Day 29 Lab: HSRP Configuration",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2029%20Lab%20-%20HSRP%20Configuration.pkt"
  },
  {
    "id": "lab-day-31-ipv6-configuration-part-1",
    "day": 31,
    "filename": "Day 31 Lab - IPv6 Configuration Part 1.pkt",
    "title": "Day 31 Lab: IPv6 Configuration Part 1",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2031%20Lab%20-%20IPv6%20Configuration%20Part%201.pkt"
  },
  {
    "id": "lab-day-32-ipv6-configuration-part-2",
    "day": 32,
    "filename": "Day 32 Lab - IPv6 Configuration Part 2.pkt",
    "title": "Day 32 Lab: IPv6 Configuration Part 2",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2032%20Lab%20-%20IPv6%20Configuration%20Part%202.pkt"
  },
  {
    "id": "lab-day-33-ipv6-static-routes",
    "day": 33,
    "filename": "Day 33 Lab - IPv6 Static Routes.pkt",
    "title": "Day 33 Lab: IPv6 Static Routes",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2033%20Lab%20-%20IPv6%20Static%20Routes.pkt"
  },
  {
    "id": "lab-day-34-standard-acls",
    "day": 34,
    "filename": "Day 34 Lab - Standard ACLs.pkt",
    "title": "Day 34 Lab: Standard ACLs",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2034%20Lab%20-%20Standard%20ACLs.pkt"
  },
  {
    "id": "lab-day-35-extended-acls",
    "day": 35,
    "filename": "Day 35 Lab - Extended ACLs.pkt",
    "title": "Day 35 Lab: Extended ACLs",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2035%20Lab%20-%20Extended%20ACLs.pkt"
  },
  {
    "id": "lab-day-36-cdp---lldp",
    "day": 36,
    "filename": "Day 36 Lab - CDP & LLDP.pkt",
    "title": "Day 36 Lab: CDP & LLDP",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2036%20Lab%20-%20CDP%20%26%20LLDP.pkt"
  },
  {
    "id": "lab-day-37-ntp",
    "day": 37,
    "filename": "Day 37 Lab - NTP.pkt",
    "title": "Day 37 Lab: NTP",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2037%20Lab%20-%20NTP.pkt"
  },
  {
    "id": "lab-day-38-dns",
    "day": 38,
    "filename": "Day 38 Lab - DNS.pkt",
    "title": "Day 38 Lab: DNS",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2038%20Lab%20-%20DNS.pkt"
  },
  {
    "id": "lab-day-39-dhcp",
    "day": 39,
    "filename": "Day 39 Lab - DHCP.pkt",
    "title": "Day 39 Lab: DHCP",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2039%20Lab%20-%20DHCP.pkt"
  },
  {
    "id": "lab-day-40-snmp",
    "day": 40,
    "filename": "Day 40 Lab - SNMP.pkt",
    "title": "Day 40 Lab: SNMP",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2040%20Lab%20-%20SNMP.pkt"
  },
  {
    "id": "lab-day-41-syslog",
    "day": 41,
    "filename": "Day 41 Lab - Syslog.pkt",
    "title": "Day 41 Lab: Syslog",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2041%20Lab%20-%20Syslog.pkt"
  },
  {
    "id": "lab-day-42-ssh",
    "day": 42,
    "filename": "Day 42 Lab - SSH.pkt",
    "title": "Day 42 Lab: SSH",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2042%20Lab%20-%20SSH.pkt"
  },
  {
    "id": "lab-day-43-ftp---tftp",
    "day": 43,
    "filename": "Day 43 Lab - FTP & TFTP.pkt",
    "title": "Day 43 Lab: FTP & TFTP",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2043%20Lab%20-%20FTP%20%26%20TFTP.pkt"
  },
  {
    "id": "lab-day-44-static-nat",
    "day": 44,
    "filename": "Day 44 Lab - Static NAT.pkt",
    "title": "Day 44 Lab: Static NAT",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2044%20Lab%20-%20Static%20NAT.pkt"
  },
  {
    "id": "lab-day-45-dynamic-nat",
    "day": 45,
    "filename": "Day 45 Lab - Dynamic NAT.pkt",
    "title": "Day 45 Lab: Dynamic NAT",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2045%20Lab%20-%20Dynamic%20NAT.pkt"
  },
  {
    "id": "lab-day-46-voice-vlans",
    "day": 46,
    "filename": "Day 46 Lab - Voice VLANs.pkt",
    "title": "Day 46 Lab: Voice VLANs",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2046%20Lab%20-%20Voice%20VLANs.pkt"
  },
  {
    "id": "lab-day-47-qos",
    "day": 47,
    "filename": "Day 47 Lab - QoS.pkt",
    "title": "Day 47 Lab: QoS",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2047%20Lab%20-%20QoS.pkt"
  },
  {
    "id": "lab-day-49-port-security",
    "day": 49,
    "filename": "Day 49 Lab - Port Security.pkt",
    "title": "Day 49 Lab: Port Security",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2049%20Lab%20-%20Port%20Security.pkt"
  },
  {
    "id": "lab-day-50-dhcp-snooping",
    "day": 50,
    "filename": "Day 50 Lab - DHCP Snooping.pkt",
    "title": "Day 50 Lab: DHCP Snooping",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2050%20Lab%20-%20DHCP%20Snooping.pkt"
  },
  {
    "id": "lab-day-51-dynamic-arp-inspection",
    "day": 51,
    "filename": "Day 51 Lab - Dynamic ARP Inspection.pkt",
    "title": "Day 51 Lab: Dynamic ARP Inspection",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2051%20Lab%20-%20Dynamic%20ARP%20Inspection.pkt"
  },
  {
    "id": "lab-day-52-stp---hsrp-synchronization",
    "day": 52,
    "filename": "Day 52 Lab - STP & HSRP Synchronization.pkt",
    "title": "Day 52 Lab: STP & HSRP Synchronization",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2052%20Lab%20-%20STP%20%26%20HSRP%20Synchronization.pkt"
  },
  {
    "id": "lab-day-53-gre-tunnels",
    "day": 53,
    "filename": "Day 53 Lab - GRE Tunnels.pkt",
    "title": "Day 53 Lab: GRE Tunnels",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2053%20Lab%20-%20GRE%20Tunnels.pkt"
  },
  {
    "id": "lab-day-58-wireless-lans",
    "day": 58,
    "filename": "Day 58 Lab - Wireless LANs.pkt",
    "title": "Day 58 Lab: Wireless LANs",
    "downloadUrl": "https://raw.githubusercontent.com/stuff97/JeremyITLab-CCNA/master/PacketTracer-Labs/Day%2058%20Lab%20-%20Wireless%20LANs.pkt"
  }
];
