/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Student, Subject, User, GradingScaleRule, ReportConfig, Grade, Attendance, FeePayment, ClassroomInventoryRecord, BookStockItem, BookSaleRecord } from '../types';

export const INITIAL_CLASSES = {
  NURSERY: ['Nursery 1', 'Nursery 2'],
  KINDERGARTEN: ['Kindergarten 1', 'Kindergarten 2'],
  PRIMARY: ['Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6'],
  JHS: ['JHS 1', 'JHS 2', 'JHS 3']
};

export const INITIAL_SUBJECTS: Subject[] = [
  // Nursery
  { id: 'sub-n-cr', name: 'CREATIVITY', code: 'CRT', level: 'NURSERY' },
  { id: 'sub-n-lit', name: 'LITERACY / LANGUAGE', code: 'LIT', level: 'NURSERY' },
  { id: 'sub-n-num', name: 'NUMERACY', code: 'NUM', level: 'NURSERY' },
  { id: 'sub-n-pho', name: 'PHONICS', code: 'PHO', level: 'NURSERY' },
  { id: 'sub-n-psy', name: 'PSYCHOMOTOR SKILLS', code: 'PSY', level: 'NURSERY' },

  // Kindergarten
  { id: 'sub-k-lit', name: 'LITERACY / LANGUAGE', code: 'LIT', level: 'KINDERGARTEN' },
  { id: 'sub-k-num', name: 'NUMERACY', code: 'NUM', level: 'KINDERGARTEN' },
  { id: 'sub-k-owop', name: 'OUR WORLD OUR PEOPLE', code: 'OWOP', level: 'KINDERGARTEN' },
  { id: 'sub-k-ca', name: 'CREATIVE ARTS', code: 'CA', level: 'KINDERGARTEN' },
  { id: 'sub-k-wrt', name: 'WRITING', code: 'WRT', level: 'KINDERGARTEN' },

  // Primary
  { id: 'sub-p-eng', name: 'English language', code: 'ENG', level: 'PRIMARY' },
  { id: 'sub-p-math', name: 'Mathematics', code: 'MAT', level: 'PRIMARY' },
  { id: 'sub-p-sci', name: 'Science', code: 'SCI', level: 'PRIMARY' },
  { id: 'sub-p-his', name: 'History', code: 'HIS', level: 'PRIMARY' },
  { id: 'sub-p-rme', name: 'Religious and Moral Education', code: 'RME', level: 'PRIMARY' },
  { id: 'sub-p-gh', name: 'Akuapem Twi', code: 'TWI', level: 'PRIMARY' },
  { id: 'sub-p-art', name: 'Creative Arts', code: 'ART', level: 'PRIMARY' },
  { id: 'sub-p-soc', name: 'Our World Our People', code: 'OWOP', level: 'PRIMARY' },
  { id: 'sub-p-ict', name: 'Computing', code: 'COMP', level: 'PRIMARY' },
  { id: 'sub-p-fr', name: 'French', code: 'FRE', level: 'PRIMARY' },

  // JHS
  { id: 'sub-j-eng', name: 'English language', code: 'ENG', level: 'JHS' },
  { id: 'sub-j-math', name: 'Mathematics', code: 'MAT', level: 'JHS' },
  { id: 'sub-j-sci', name: 'Science', code: 'SCI', level: 'JHS' },
  { id: 'sub-j-soc', name: 'Social Studies', code: 'SOC', level: 'JHS' },
  { id: 'sub-j-car', name: 'Career Technology', code: 'CAR', level: 'JHS' },
  { id: 'sub-j-rme', name: 'Religious and Moral Education', code: 'RME', level: 'JHS' },
  { id: 'sub-j-gh', name: 'Akuapem Twi', code: 'TWI', level: 'JHS' },
  { id: 'sub-j-ca', name: 'Creative Arts and Design', code: 'CAD', level: 'JHS' },
  { id: 'sub-j-fr', name: 'French', code: 'FRE', level: 'JHS' },
  { id: 'sub-j-ict', name: 'Computing', code: 'COMP', level: 'JHS' }
];

export const INITIAL_STUDENTS: Student[] = [
  // Nursery 1
  { id: "st-105", name: "Abena Osei", rollNumber: "EA/N1/2026/001", level: "NURSERY", className: "Nursery 1", guardianName: "Charles Osei", guardianEmail: "charles@osei.com", guardianPhone: "+233551234567" },
  { id: "st-110", name: "Kofi Badu", rollNumber: "EA/N1/2026/002", level: "NURSERY", className: "Nursery 1", guardianName: "Kwaku Badu", guardianEmail: "badu@eastfield.com", guardianPhone: "+233241230001" },
  { id: "st-n1-03", name: "Akua Afriyie", rollNumber: "EA/N1/2026/003", level: "NURSERY", className: "Nursery 1", guardianName: "George Afriyie", guardianEmail: "afriyie@eastfield.com", guardianPhone: "+233241230007" },
  { id: "st-n1-04", name: "Kwabena Frimpong", rollNumber: "EA/N1/2026/004", level: "NURSERY", className: "Nursery 1", guardianName: "Nana Frimpong", guardianEmail: "frimpong@eastfield.com", guardianPhone: "+233241230008" },
  { id: "st-n1-05", name: "Kwadwo Mensah", rollNumber: "EA/N1/2026/005", level: "NURSERY", className: "Nursery 1", guardianName: "Peter Mensah", guardianEmail: "kwadwomensah@eastfield.com", guardianPhone: "+233241230044" },
  { id: "st-n1-06", name: "Yaa Pokuaa", rollNumber: "EA/N1/2026/006", level: "NURSERY", className: "Nursery 1", guardianName: "Grace Pokuaa", guardianEmail: "yaapokuaa@eastfield.com", guardianPhone: "+233241230045" },
  { id: "st-n1-07", name: "Yaw Boadi", rollNumber: "EA/N1/2026/007", level: "NURSERY", className: "Nursery 1", guardianName: "Francis Boadi", guardianEmail: "yawboadi@eastfield.com", guardianPhone: "+233241230046" },
  { id: "st-n1-08", name: "Ama Kyerewaa", rollNumber: "EA/N1/2026/008", level: "NURSERY", className: "Nursery 1", guardianName: "Theresa Kyerewaa", guardianEmail: "amakyerewaa@eastfield.com", guardianPhone: "+233241230047" },
  { id: "st-n1-09", name: "Kofi Adjei", rollNumber: "EA/N1/2026/009", level: "NURSERY", className: "Nursery 1", guardianName: "Samuel Adjei", guardianEmail: "kofiadjei@eastfield.com", guardianPhone: "+233241230048" },
  { id: "st-n1-10", name: "Akosua Agyeman", rollNumber: "EA/N1/2026/010", level: "NURSERY", className: "Nursery 1", guardianName: "Daniel Agyeman", guardianEmail: "akosuaagyeman@eastfield.com", guardianPhone: "+233241230049" },
  { id: "st-n1-11", name: "Paa Kwesi Arthur", rollNumber: "EA/N1/2026/011", level: "NURSERY", className: "Nursery 1", guardianName: "Joseph Arthur", guardianEmail: "paakwesiarthur@eastfield.com", guardianPhone: "+233241230050" },
  { id: "st-n1-12", name: "Esi Appiah", rollNumber: "EA/N1/2026/012", level: "NURSERY", className: "Nursery 1", guardianName: "Mary Appiah", guardianEmail: "esiappiah@eastfield.com", guardianPhone: "+233241230051" },
  { id: "st-n1-13", name: "Kwabena Asare", rollNumber: "EA/N1/2026/013", level: "NURSERY", className: "Nursery 1", guardianName: "Godwin Asare", guardianEmail: "kwabenaasare@eastfield.com", guardianPhone: "+233241230052" },

  // Nursery 2
  { id: "st-111", name: "Adwoa Saah", rollNumber: "EA/N2/2026/001", level: "NURSERY", className: "Nursery 2", guardianName: "Madam Saah", guardianEmail: "saah@eastfield.com", guardianPhone: "+233241230002" },
  { id: "st-112", name: "Kwaku Ananse", rollNumber: "EA/N2/2026/002", level: "NURSERY", className: "Nursery 2", guardianName: "Poku Ananse", guardianEmail: "ananse@eastfield.com", guardianPhone: "+233241230003" },
  { id: "st-n2-03", name: "Nana Yaw Bediako", rollNumber: "EA/N2/2026/003", level: "NURSERY", className: "Nursery 2", guardianName: "Yaw Bediako", guardianEmail: "bediako@eastfield.com", guardianPhone: "+233241230009" },
  { id: "st-n2-04", name: "Serwaa Bonsu", rollNumber: "EA/N2/2026/004", level: "NURSERY", className: "Nursery 2", guardianName: "Rita Bonsu", guardianEmail: "bonsu@eastfield.com", guardianPhone: "+233241230010" },
  { id: "st-n2-05", name: "Prince Odoom", rollNumber: "EA/N2/2026/005", level: "NURSERY", className: "Nursery 2", guardianName: "Isaac Odoom", guardianEmail: "princeodoom@eastfield.com", guardianPhone: "+233241230053" },
  { id: "st-n2-06", name: "Maame Akua Sarpong", rollNumber: "EA/N2/2026/006", level: "NURSERY", className: "Nursery 2", guardianName: "Juliana Sarpong", guardianEmail: "maameakuasarpong@eastfield.com", guardianPhone: "+233241230054" },
  { id: "st-n2-07", name: "Joseph Kyeremeh", rollNumber: "EA/N2/2026/007", level: "NURSERY", className: "Nursery 2", guardianName: "Alex Kyeremeh", guardianEmail: "josephkyeremeh@eastfield.com", guardianPhone: "+233241230055" },
  { id: "st-n2-08", name: "Gifty Owusuwaa", rollNumber: "EA/N2/2026/008", level: "NURSERY", className: "Nursery 2", guardianName: "Beatrice Owusuwaa", guardianEmail: "giftyowusuwaa@eastfield.com", guardianPhone: "+233241230056" },
  { id: "st-n2-09", name: "Samuel Antwi-Boasiako", rollNumber: "EA/N2/2026/009", level: "NURSERY", className: "Nursery 2", guardianName: "Ernest Antwi", guardianEmail: "samuelantwiboasiako@eastfield.com", guardianPhone: "+233241230057" },
  { id: "st-n2-10", name: "Linda Donkor", rollNumber: "EA/N2/2026/010", level: "NURSERY", className: "Nursery 2", guardianName: "Agnes Donkor", guardianEmail: "lindadonkor@eastfield.com", guardianPhone: "+233241230058" },
  { id: "st-n2-11", name: "Emmanuel Darkwah", rollNumber: "EA/N2/2026/011", level: "NURSERY", className: "Nursery 2", guardianName: "Solomon Darkwah", guardianEmail: "emmanueldarkwah@eastfield.com", guardianPhone: "+233241230059" },
  { id: "st-n2-12", name: "Angela Tetteh", rollNumber: "EA/N2/2026/012", level: "NURSERY", className: "Nursery 2", guardianName: "Patience Tetteh", guardianEmail: "angelatetteh@eastfield.com", guardianPhone: "+233241230060" },
  { id: "st-n2-13", name: "David Boateng", rollNumber: "EA/N2/2026/013", level: "NURSERY", className: "Nursery 2", guardianName: "Benjamin Boateng", guardianEmail: "davidboateng@eastfield.com", guardianPhone: "+233241230061" },

  // Kindergarten 1
  { id: "st-106", name: "Yaw Ofori", rollNumber: "EA/KG1/2026/001", level: "KINDERGARTEN", className: "Kindergarten 1", guardianName: "Seth Ofori", guardianEmail: "seth@ofori.com", guardianPhone: "+233241112233" },
  { id: "st-113", name: "Efya Pokua", rollNumber: "EA/KG1/2026/002", level: "KINDERGARTEN", className: "Kindergarten 1", guardianName: "Osei Poku", guardianEmail: "poku@eastfield.com", guardianPhone: "+233241230004" },
  { id: "st-kg1-03", name: "Kofi Appau", rollNumber: "EA/KG1/2026/003", level: "KINDERGARTEN", className: "Kindergarten 1", guardianName: "Joseph Appau", guardianEmail: "appau@eastfield.com", guardianPhone: "+233241230011" },
  { id: "st-kg1-04", name: "Afia Owusu", rollNumber: "EA/KG1/2026/004", level: "KINDERGARTEN", className: "Kindergarten 1", guardianName: "Evelyn Owusu", guardianEmail: "owusu@eastfield.com", guardianPhone: "+233241230012" },
  { id: "st-kg1-05", name: "Derrick Kwakye", rollNumber: "EA/KG1/2026/005", level: "KINDERGARTEN", className: "Kindergarten 1", guardianName: "Matthew Kwakye", guardianEmail: "derrickkwakye@eastfield.com", guardianPhone: "+233241230062" },
  { id: "st-kg1-06", name: "Nana Ama Danquah", rollNumber: "EA/KG1/2026/006", level: "KINDERGARTEN", className: "Kindergarten 1", guardianName: "Eunice Danquah", guardianEmail: "nanaamadanquah@eastfield.com", guardianPhone: "+233241230063" },
  { id: "st-kg1-07", name: "Caleb Mensah", rollNumber: "EA/KG1/2026/007", level: "KINDERGARTEN", className: "Kindergarten 1", guardianName: "Stephen Mensah", guardianEmail: "calebmensah@eastfield.com", guardianPhone: "+233241230064" },
  { id: "st-kg1-08", name: "Abigail Frimpong", rollNumber: "EA/KG1/2026/008", level: "KINDERGARTEN", className: "Kindergarten 1", guardianName: "Doris Frimpong", guardianEmail: "abigailfrimpong@eastfield.com", guardianPhone: "+233241230065" },
  { id: "st-kg1-09", name: "Isaac Boamah", rollNumber: "EA/KG1/2026/009", level: "KINDERGARTEN", className: "Kindergarten 1", guardianName: "Charles Boamah", guardianEmail: "isaacboamah@eastfield.com", guardianPhone: "+233241230066" },
  { id: "st-kg1-10", name: "Priscilla Gyasi", rollNumber: "EA/KG1/2026/010", level: "KINDERGARTEN", className: "Kindergarten 1", guardianName: "Victoria Gyasi", guardianEmail: "priscillagyasi@eastfield.com", guardianPhone: "+233241230067" },
  { id: "st-kg1-11", name: "Kelvin Nkrumah", rollNumber: "EA/KG1/2026/011", level: "KINDERGARTEN", className: "Kindergarten 1", guardianName: "George Nkrumah", guardianEmail: "kelvinnkrumah@eastfield.com", guardianPhone: "+233241230068" },
  { id: "st-kg1-12", name: "Jessica Asiedu", rollNumber: "EA/KG1/2026/012", level: "KINDERGARTEN", className: "Kindergarten 1", guardianName: "Lydia Asiedu", guardianEmail: "jessicaasiedu@eastfield.com", guardianPhone: "+233241230069" },
  { id: "st-kg1-13", name: "Daniel Oppong", rollNumber: "EA/KG1/2026/013", level: "KINDERGARTEN", className: "Kindergarten 1", guardianName: "Francis Oppong", guardianEmail: "danieloppong@eastfield.com", guardianPhone: "+233241230070" },

  // Kindergarten 2
  { id: "st-114", name: "Kwadwo Sheldon", rollNumber: "EA/KG2/2026/001", level: "KINDERGARTEN", className: "Kindergarten 2", guardianName: "Samuel Sheldon", guardianEmail: "sheldon@eastfield.com", guardianPhone: "+233241230005" },
  { id: "st-115", name: "Akua Donkor", rollNumber: "EA/KG2/2026/002", level: "KINDERGARTEN", className: "Kindergarten 2", guardianName: "Isaac Donkor", guardianEmail: "donkor@eastfield.com", guardianPhone: "+233241230006" },
  { id: "st-kg2-03", name: "Kojo Antwi", rollNumber: "EA/KG2/2026/003", level: "KINDERGARTEN", className: "Kindergarten 2", guardianName: "Peter Antwi", guardianEmail: "antwi@eastfield.com", guardianPhone: "+233241230013" },
  { id: "st-kg2-04", name: "Maame Serwaa", rollNumber: "EA/KG2/2026/004", level: "KINDERGARTEN", className: "Kindergarten 2", guardianName: "Doris Serwaa", guardianEmail: "serwaa@eastfield.com", guardianPhone: "+233241230014" },
  { id: "st-kg2-05", name: "Richmond Agyapong", rollNumber: "EA/KG2/2026/005", level: "KINDERGARTEN", className: "Kindergarten 2", guardianName: "Eric Agyapong", guardianEmail: "richmondagyapong@eastfield.com", guardianPhone: "+233241230071" },
  { id: "st-kg2-06", name: "Cynthia Amoah", rollNumber: "EA/KG2/2026/006", level: "KINDERGARTEN", className: "Kindergarten 2", guardianName: "Faustina Amoah", guardianEmail: "cynthiaamoah@eastfield.com", guardianPhone: "+233241230072" },
  { id: "st-kg2-07", name: "George Baah", rollNumber: "EA/KG2/2026/007", level: "KINDERGARTEN", className: "Kindergarten 2", guardianName: "Henry Baah", guardianEmail: "georgebaah@eastfield.com", guardianPhone: "+233241230073" },
  { id: "st-kg2-08", name: "Felicia Osei", rollNumber: "EA/KG2/2026/008", level: "KINDERGARTEN", className: "Kindergarten 2", guardianName: "Harriet Osei", guardianEmail: "feliciaosei@eastfield.com", guardianPhone: "+233241230074" },
  { id: "st-kg2-09", name: "Benedict Quansah", rollNumber: "EA/KG2/2026/009", level: "KINDERGARTEN", className: "Kindergarten 2", guardianName: "Paul Quansah", guardianEmail: "benedictquansah@eastfield.com", guardianPhone: "+233241230075" },
  { id: "st-kg2-10", name: "Sarah Twumasi", rollNumber: "EA/KG2/2026/010", level: "KINDERGARTEN", className: "Kindergarten 2", guardianName: "Rose Twumasi", guardianEmail: "sarahtwumasi@eastfield.com", guardianPhone: "+233241230076" },
  { id: "st-kg2-11", name: "Stephen Koranteng", rollNumber: "EA/KG2/2026/011", level: "KINDERGARTEN", className: "Kindergarten 2", guardianName: "Michael Koranteng", guardianEmail: "stephenkoranteng@eastfield.com", guardianPhone: "+233241230077" },
  { id: "st-kg2-12", name: "Janet Adomako", rollNumber: "EA/KG2/2026/012", level: "KINDERGARTEN", className: "Kindergarten 2", guardianName: "Mercy Adomako", guardianEmail: "janetadomako@eastfield.com", guardianPhone: "+233241230078" },
  { id: "st-kg2-13", name: "Michael Prempeh", rollNumber: "EA/KG2/2026/013", level: "KINDERGARTEN", className: "Kindergarten 2", guardianName: "Albert Prempeh", guardianEmail: "michaelprempeh@eastfield.com", guardianPhone: "+233241230079" },

  // Primary 1
  { id: "st-101", name: "Kwame Asante", rollNumber: "EA/P1/2026/001", level: "PRIMARY", className: "Primary 1", guardianName: "Emmanuel Asante", guardianEmail: "emmanuel@asante.com", guardianPhone: "+233241234567" },
  { id: "st-102", name: "Ama Boateng", rollNumber: "EA/P1/2026/002", level: "PRIMARY", className: "Primary 1", guardianName: "Kofi Boateng", guardianEmail: "kofi@boateng.com", guardianPhone: "+233501234567" },
  { id: "st-p1-03", name: "Samuel Cudjoe", rollNumber: "EA/P1/2026/003", level: "PRIMARY", className: "Primary 1", guardianName: "Victor Cudjoe", guardianEmail: "cudjoe@eastfield.com", guardianPhone: "+233241230015" },
  { id: "st-p1-04", name: "Priscilla Amankwah", rollNumber: "EA/P1/2026/004", level: "PRIMARY", className: "Primary 1", guardianName: "Agnes Amankwah", guardianEmail: "amankwah@eastfield.com", guardianPhone: "+233241230016" },
  { id: "st-p1-05", name: "Joshua Annan", rollNumber: "EA/P1/2026/005", level: "PRIMARY", className: "Primary 1", guardianName: "Martin Annan", guardianEmail: "joshuaannan@eastfield.com", guardianPhone: "+233241230080" },
  { id: "st-p1-06", name: "Victoria Ohemeng", rollNumber: "EA/P1/2026/006", level: "PRIMARY", className: "Primary 1", guardianName: "Rebecca Ohemeng", guardianEmail: "victoriaohemeng@eastfield.com", guardianPhone: "+233241230081" },
  { id: "st-p1-07", name: "Bright Badu", rollNumber: "EA/P1/2026/007", level: "PRIMARY", className: "Primary 1", guardianName: "Collins Badu", guardianEmail: "brightbadu@eastfield.com", guardianPhone: "+233241230082" },
  { id: "st-p1-08", name: "Diana Asare", rollNumber: "EA/P1/2026/008", level: "PRIMARY", className: "Primary 1", guardianName: "Theresa Asare", guardianEmail: "dianaasare@eastfield.com", guardianPhone: "+233241230083" },
  { id: "st-p1-09", name: "Collins Yeboah", rollNumber: "EA/P1/2026/009", level: "PRIMARY", className: "Primary 1", guardianName: "Frank Yeboah", guardianEmail: "collinsyeboah@eastfield.com", guardianPhone: "+233241230084" },
  { id: "st-p1-10", name: "Gloria Owusu", rollNumber: "EA/P1/2026/010", level: "PRIMARY", className: "Primary 1", guardianName: "Esther Owusu", guardianEmail: "gloriaowusu@eastfield.com", guardianPhone: "+233241230085" },
  { id: "st-p1-11", name: "Francis Forson", rollNumber: "EA/P1/2026/011", level: "PRIMARY", className: "Primary 1", guardianName: "Elijah Forson", guardianEmail: "francisforson@eastfield.com", guardianPhone: "+233241230086" },
  { id: "st-p1-12", name: "Rita Boadu", rollNumber: "EA/P1/2026/012", level: "PRIMARY", className: "Primary 1", guardianName: "Gladys Boadu", guardianEmail: "ritaboadu@eastfield.com", guardianPhone: "+233241230087" },
  { id: "st-p1-13", name: "Bernard Quaye", rollNumber: "EA/P1/2026/013", level: "PRIMARY", className: "Primary 1", guardianName: "Robert Quaye", guardianEmail: "bernardquaye@eastfield.com", guardianPhone: "+233241230088" },
  { id: "st-p1-14", name: "Esther Agyemang", rollNumber: "EA/P1/2026/014", level: "PRIMARY", className: "Primary 1", guardianName: "Comfort Agyemang", guardianEmail: "estheragyemang@eastfield.com", guardianPhone: "+233241230089" },

  // Primary 2
  { id: "st-p2-01", name: "Emmanuel Gyasi", rollNumber: "EA/P2/2026/001", level: "PRIMARY", className: "Primary 2", guardianName: "Matthew Gyasi", guardianEmail: "gyasi@eastfield.com", guardianPhone: "+233241230017" },
  { id: "st-p2-02", name: "Blessing Arthur", rollNumber: "EA/P2/2026/002", level: "PRIMARY", className: "Primary 2", guardianName: "Hannah Arthur", guardianEmail: "arthur@eastfield.com", guardianPhone: "+233241230018" },
  { id: "st-p2-03", name: "Prince Boateng", rollNumber: "EA/P2/2026/003", level: "PRIMARY", className: "Primary 2", guardianName: "Clement Boateng", guardianEmail: "cboateng@eastfield.com", guardianPhone: "+233241230019" },
  { id: "st-p2-04", name: "Eunice Mensah", rollNumber: "EA/P2/2026/004", level: "PRIMARY", className: "Primary 2", guardianName: "Esther Mensah", guardianEmail: "emensah@eastfield.com", guardianPhone: "+233241230020" },
  { id: "st-p2-05", name: "Gideon Ansah", rollNumber: "EA/P2/2026/005", level: "PRIMARY", className: "Primary 2", guardianName: "Simon Ansah", guardianEmail: "gideonansah@eastfield.com", guardianPhone: "+233241230090" },
  { id: "st-p2-06", name: "Harriet Kwarteng", rollNumber: "EA/P2/2026/006", level: "PRIMARY", className: "Primary 2", guardianName: "Priscilla Kwarteng", guardianEmail: "harrietkwarteng@eastfield.com", guardianPhone: "+233241230091" },
  { id: "st-p2-07", name: "Felix Antwi", rollNumber: "EA/P2/2026/007", level: "PRIMARY", className: "Primary 2", guardianName: "Dennis Antwi", guardianEmail: "felixantwi@eastfield.com", guardianPhone: "+233241230092" },
  { id: "st-p2-08", name: "Sandra Osei", rollNumber: "EA/P2/2026/008", level: "PRIMARY", className: "Primary 2", guardianName: "Beatrice Osei", guardianEmail: "sandraosei@eastfield.com", guardianPhone: "+233241230093" },
  { id: "st-p2-09", name: "Maxwell Boakye", rollNumber: "EA/P2/2026/009", level: "PRIMARY", className: "Primary 2", guardianName: "Edward Boakye", guardianEmail: "maxwellboakye@eastfield.com", guardianPhone: "+233241230094" },
  { id: "st-p2-10", name: "Irene Appiah", rollNumber: "EA/P2/2026/010", level: "PRIMARY", className: "Primary 2", guardianName: "Agnes Appiah", guardianEmail: "ireneappiah@eastfield.com", guardianPhone: "+233241230095" },
  { id: "st-p2-11", name: "Joseph Darko", rollNumber: "EA/P2/2026/011", level: "PRIMARY", className: "Primary 2", guardianName: "Anthony Darko", guardianEmail: "josephdarko@eastfield.com", guardianPhone: "+233241230096" },
  { id: "st-p2-12", name: "Ruth Sarpong", rollNumber: "EA/P2/2026/012", level: "PRIMARY", className: "Primary 2", guardianName: "Charity Sarpong", guardianEmail: "ruthsarpong@eastfield.com", guardianPhone: "+233241230097" },
  { id: "st-p2-13", name: "Dennis Acheampong", rollNumber: "EA/P2/2026/013", level: "PRIMARY", className: "Primary 2", guardianName: "Vincent Acheampong", guardianEmail: "dennisacheampong@eastfield.com", guardianPhone: "+233241230098" },

  // Primary 3
  { id: "st-p3-01", name: "Richmond Darko", rollNumber: "EA/P3/2026/001", level: "PRIMARY", className: "Primary 3", guardianName: "Richard Darko", guardianEmail: "darko@eastfield.com", guardianPhone: "+233241230021" },
  { id: "st-p3-02", name: "Abigail Quaye", rollNumber: "EA/P3/2026/002", level: "PRIMARY", className: "Primary 3", guardianName: "Solomon Quaye", guardianEmail: "quaye@eastfield.com", guardianPhone: "+233241230022" },
  { id: "st-p3-03", name: "Dennis Agyei", rollNumber: "EA/P3/2026/003", level: "PRIMARY", className: "Primary 3", guardianName: "Collins Agyei", guardianEmail: "agyei@eastfield.com", guardianPhone: "+233241230023" },
  { id: "st-p3-04", name: "Gifty Baidoo", rollNumber: "EA/P3/2026/004", level: "PRIMARY", className: "Primary 3", guardianName: "Martha Baidoo", guardianEmail: "baidoo@eastfield.com", guardianPhone: "+233241230024" },
  { id: "st-p3-05", name: "Evans Tetteh", rollNumber: "EA/P3/2026/005", level: "PRIMARY", className: "Primary 3", guardianName: "George Tetteh", guardianEmail: "evanstetteh@eastfield.com", guardianPhone: "+233241230099" },
  { id: "st-p3-06", name: "Mary Owusu-Ansah", rollNumber: "EA/P3/2026/006", level: "PRIMARY", className: "Primary 3", guardianName: "Felicia Owusu-Ansah", guardianEmail: "maryowusuansah@eastfield.com", guardianPhone: "+233241230100" },
  { id: "st-p3-07", name: "Philip Amponsah", rollNumber: "EA/P3/2026/007", level: "PRIMARY", className: "Primary 3", guardianName: "Victor Amponsah", guardianEmail: "philipamponsah@eastfield.com", guardianPhone: "+233241230101" },
  { id: "st-p3-08", name: "Lydia Asamoah", rollNumber: "EA/P3/2026/008", level: "PRIMARY", className: "Primary 3", guardianName: "Grace Asamoah", guardianEmail: "lydiaasamoah@eastfield.com", guardianPhone: "+233241230102" },
  { id: "st-p3-09", name: "Kelvin Addo", rollNumber: "EA/P3/2026/009", level: "PRIMARY", className: "Primary 3", guardianName: "Charles Addo", guardianEmail: "kelvinaddo@eastfield.com", guardianPhone: "+233241230103" },
  { id: "st-p3-10", name: "Faustina Frimpong", rollNumber: "EA/P3/2026/010", level: "PRIMARY", className: "Primary 3", guardianName: "Janet Frimpong", guardianEmail: "faustinafrimpong@eastfield.com", guardianPhone: "+233241230104" },
  { id: "st-p3-11", name: "Andrew Boadi", rollNumber: "EA/P3/2026/011", level: "PRIMARY", className: "Primary 3", guardianName: "Richard Boadi", guardianEmail: "andrewboadi@eastfield.com", guardianPhone: "+233241230105" },
  { id: "st-p3-12", name: "Joyce Danquah", rollNumber: "EA/P3/2026/012", level: "PRIMARY", className: "Primary 3", guardianName: "Evelyn Danquah", guardianEmail: "joycedanquah@eastfield.com", guardianPhone: "+233241230106" },
  { id: "st-p3-13", name: "Paul Nyarko", rollNumber: "EA/P3/2026/013", level: "PRIMARY", className: "Primary 3", guardianName: "Thomas Nyarko", guardianEmail: "paulnyarko@eastfield.com", guardianPhone: "+233241230107" },

  // Primary 4
  { id: "st-p4-01", name: "Godwin Tetteh", rollNumber: "EA/P4/2026/001", level: "PRIMARY", className: "Primary 4", guardianName: "John Tetteh", guardianEmail: "tetteh@eastfield.com", guardianPhone: "+233241230025" },
  { id: "st-p4-02", name: "Patricia Sackey", rollNumber: "EA/P4/2026/002", level: "PRIMARY", className: "Primary 4", guardianName: "Beatrice Sackey", guardianEmail: "sackey@eastfield.com", guardianPhone: "+233241230026" },
  { id: "st-p4-03", name: "Solomon Ampofo", rollNumber: "EA/P4/2026/003", level: "PRIMARY", className: "Primary 4", guardianName: "Elijah Ampofo", guardianEmail: "ampofo@eastfield.com", guardianPhone: "+233241230027" },
  { id: "st-p4-04", name: "Dorothy Danquah", rollNumber: "EA/P4/2026/004", level: "PRIMARY", className: "Primary 4", guardianName: "Frank Danquah", guardianEmail: "danquah@eastfield.com", guardianPhone: "+233241230028" },
  { id: "st-p4-05", name: "Isaac Mensah", rollNumber: "EA/P4/2026/005", level: "PRIMARY", className: "Primary 4", guardianName: "Joseph Mensah", guardianEmail: "isaacmensah@eastfield.com", guardianPhone: "+233241230108" },
  { id: "st-p4-06", name: "Regina Osei", rollNumber: "EA/P4/2026/006", level: "PRIMARY", className: "Primary 4", guardianName: "Elizabeth Osei", guardianEmail: "reginaosei@eastfield.com", guardianPhone: "+233241230109" },
  { id: "st-p4-07", name: "Samuel Donkor", rollNumber: "EA/P4/2026/007", level: "PRIMARY", className: "Primary 4", guardianName: "William Donkor", guardianEmail: "samueldonkor@eastfield.com", guardianPhone: "+233241230110" },
  { id: "st-p4-08", name: "Comfort Arthur", rollNumber: "EA/P4/2026/008", level: "PRIMARY", className: "Primary 4", guardianName: "Mercy Arthur", guardianEmail: "comfortarthur@eastfield.com", guardianPhone: "+233241230111" },
  { id: "st-p4-09", name: "Benjamin Badu", rollNumber: "EA/P4/2026/009", level: "PRIMARY", className: "Primary 4", guardianName: "Kofi Badu Snr", guardianEmail: "benjaminbadu@eastfield.com", guardianPhone: "+233241230112" },
  { id: "st-p4-10", name: "Vera Kyeremeh", rollNumber: "EA/P4/2026/010", level: "PRIMARY", className: "Primary 4", guardianName: "Theresa Kyeremeh", guardianEmail: "verakyeremeh@eastfield.com", guardianPhone: "+233241230113" },
  { id: "st-p4-11", name: "Caleb Asare", rollNumber: "EA/P4/2026/011", level: "PRIMARY", className: "Primary 4", guardianName: "Peter Asare", guardianEmail: "calebasare@eastfield.com", guardianPhone: "+233241230114" },
  { id: "st-p4-12", name: "Deborah Bonsu", rollNumber: "EA/P4/2026/012", level: "PRIMARY", className: "Primary 4", guardianName: "Rose Bonsu", guardianEmail: "deborahbonsu@eastfield.com", guardianPhone: "+233241230115" },
  { id: "st-p4-13", name: "Frank Gyasi", rollNumber: "EA/P4/2026/013", level: "PRIMARY", className: "Primary 4", guardianName: "Albert Gyasi", guardianEmail: "frankgyasi@eastfield.com", guardianPhone: "+233241230116" },

  // Primary 5
  { id: "st-p5-01", name: "Michael Kwarteng", rollNumber: "EA/P5/2026/001", level: "PRIMARY", className: "Primary 5", guardianName: "Joseph Kwarteng", guardianEmail: "kwarteng@eastfield.com", guardianPhone: "+233241230029" },
  { id: "st-p5-02", name: "Miracle Addo", rollNumber: "EA/P5/2026/002", level: "PRIMARY", className: "Primary 5", guardianName: "Janet Addo", guardianEmail: "jaddo@eastfield.com", guardianPhone: "+233241230030" },
  { id: "st-p5-03", name: "Justice Forson", rollNumber: "EA/P5/2026/003", level: "PRIMARY", className: "Primary 5", guardianName: "Albert Forson", guardianEmail: "forson@eastfield.com", guardianPhone: "+233241230031" },
  { id: "st-p5-04", name: "Beatrice Asamoah", rollNumber: "EA/P5/2026/004", level: "PRIMARY", className: "Primary 5", guardianName: "Mercy Asamoah", guardianEmail: "masamoah@eastfield.com", guardianPhone: "+233241230032" },
  { id: "st-p5-05", name: "Christian Boateng", rollNumber: "EA/P5/2026/005", level: "PRIMARY", className: "Primary 5", guardianName: "Daniel Boateng", guardianEmail: "christianboateng@eastfield.com", guardianPhone: "+233241230117" },
  { id: "st-p5-06", name: "Emelia Quaye", rollNumber: "EA/P5/2026/006", level: "PRIMARY", className: "Primary 5", guardianName: "Sophia Quaye", guardianEmail: "emeliaquaye@eastfield.com", guardianPhone: "+233241230118" },
  { id: "st-p5-07", name: "Stephen Agyei", rollNumber: "EA/P5/2026/007", level: "PRIMARY", className: "Primary 5", guardianName: "Martin Agyei", guardianEmail: "stephenagyei@eastfield.com", guardianPhone: "+233241230119" },
  { id: "st-p5-08", name: "Nancy Owusu", rollNumber: "EA/P5/2026/008", level: "PRIMARY", className: "Primary 5", guardianName: "Gladys Owusu", guardianEmail: "nancyowusu@eastfield.com", guardianPhone: "+233241230120" },
  { id: "st-p5-09", name: "Aaron Baidoo", rollNumber: "EA/P5/2026/009", level: "PRIMARY", className: "Primary 5", guardianName: "Patrick Baidoo", guardianEmail: "aaronbaidoo@eastfield.com", guardianPhone: "+233241230121" },
  { id: "st-p5-10", name: "Vivian Appiah", rollNumber: "EA/P5/2026/010", level: "PRIMARY", className: "Primary 5", guardianName: "Cecilia Appiah", guardianEmail: "vivianappiah@eastfield.com", guardianPhone: "+233241230122" },
  { id: "st-p5-11", name: "Moses Mensah", rollNumber: "EA/P5/2026/011", level: "PRIMARY", className: "Primary 5", guardianName: "Godwin Mensah", guardianEmail: "mosesmensah@eastfield.com", guardianPhone: "+233241230123" },
  { id: "st-p5-12", name: "Patience Sarpong", rollNumber: "EA/P5/2026/012", level: "PRIMARY", className: "Primary 5", guardianName: "Hannah Sarpong", guardianEmail: "patiencesarpong@eastfield.com", guardianPhone: "+233241230124" },
  { id: "st-p5-13", name: "George Annan", rollNumber: "EA/P5/2026/013", level: "PRIMARY", className: "Primary 5", guardianName: "David Annan", guardianEmail: "georgeannan@eastfield.com", guardianPhone: "+233241230125" },

  // Primary 6
  { id: "st-p6-01", name: "Kelvin Ofori-Atta", rollNumber: "EA/P6/2026/001", level: "PRIMARY", className: "Primary 6", guardianName: "Kenneth Ofori-Atta", guardianEmail: "oforiatta@eastfield.com", guardianPhone: "+233241230033" },
  { id: "st-p6-02", name: "Emmanuella Sarpong", rollNumber: "EA/P6/2026/002", level: "PRIMARY", className: "Primary 6", guardianName: "Gladys Sarpong", guardianEmail: "sarpong@eastfield.com", guardianPhone: "+233241230034" },
  { id: "st-p6-03", name: "Isaac Owusu-Ansah", rollNumber: "EA/P6/2026/003", level: "PRIMARY", className: "Primary 6", guardianName: "Benjamin Owusu-Ansah", guardianEmail: "owusuansah@eastfield.com", guardianPhone: "+233241230035" },
  { id: "st-p6-04", name: "Jessica Boadu", rollNumber: "EA/P6/2026/004", level: "PRIMARY", className: "Primary 6", guardianName: "Lydia Boadu", guardianEmail: "boadu@eastfield.com", guardianPhone: "+233241230036" },
  { id: "st-p6-05", name: "Richard Amankwah", rollNumber: "EA/P6/2026/005", level: "PRIMARY", className: "Primary 6", guardianName: "Eric Amankwah", guardianEmail: "richardamankwah@eastfield.com", guardianPhone: "+233241230126" },
  { id: "st-p6-06", name: "Belinda Asante", rollNumber: "EA/P6/2026/006", level: "PRIMARY", className: "Primary 6", guardianName: "Victoria Asante", guardianEmail: "belindaasante@eastfield.com", guardianPhone: "+233241230127" },
  { id: "st-p6-07", name: "Joseph Darkwah", rollNumber: "EA/P6/2026/007", level: "PRIMARY", className: "Primary 6", guardianName: "Anthony Darkwah", guardianEmail: "josephdarkwah@eastfield.com", guardianPhone: "+233241230128" },
  { id: "st-p6-08", name: "Theresa Cudjoe", rollNumber: "EA/P6/2026/008", level: "PRIMARY", className: "Primary 6", guardianName: "Mary Cudjoe", guardianEmail: "theresacudjoe@eastfield.com", guardianPhone: "+233241230129" },
  { id: "st-p6-09", name: "Dominic Osei", rollNumber: "EA/P6/2026/009", level: "PRIMARY", className: "Primary 6", guardianName: "Collins Osei", guardianEmail: "dominicosei@eastfield.com", guardianPhone: "+233241230130" },
  { id: "st-p6-10", name: "Janet Arthur", rollNumber: "EA/P6/2026/010", level: "PRIMARY", className: "Primary 6", guardianName: "Rita Arthur", guardianEmail: "janetarthur@eastfield.com", guardianPhone: "+233241230131" },
  { id: "st-p6-11", name: "Emmanuel Koranteng", rollNumber: "EA/P6/2026/011", level: "PRIMARY", className: "Primary 6", guardianName: "Paul Koranteng", guardianEmail: "emmanuelkoranteng@eastfield.com", guardianPhone: "+233241230132" },
  { id: "st-p6-12", name: "Elizabeth Twum", rollNumber: "EA/P6/2026/012", level: "PRIMARY", className: "Primary 6", guardianName: "Grace Twum", guardianEmail: "elizabethtwum@eastfield.com", guardianPhone: "+233241230133" },
  { id: "st-p6-13", name: "David Antwi", rollNumber: "EA/P6/2026/013", level: "PRIMARY", className: "Primary 6", guardianName: "Samuel Antwi", guardianEmail: "davidantwi@eastfield.com", guardianPhone: "+233241230134" },

  // JHS 1
  { id: "st-103", name: "Kofi Mensah", rollNumber: "EA/J1/2026/001", level: "JHS", className: "JHS 1", guardianName: "Yao Mensah", guardianEmail: "yao@mensah.com", guardianPhone: "+233271234567" },
  { id: "st-104", name: "Yaa Asantewaa", rollNumber: "EA/J1/2026/002", level: "JHS", className: "JHS 1", guardianName: "Maame Asantewaa", guardianEmail: "maame@asantewaa.com", guardianPhone: "+233201234567" },
  { id: "st-109", name: "Aboagye Messiah", rollNumber: "EA/J1/2026/003", level: "JHS", className: "JHS 1", guardianName: "Mr. Aboagye", guardianEmail: "aboagye@eastfield.com", guardianPhone: "+233241234568" },
  { id: "st-j1-04", name: "Francis Koomson", rollNumber: "EA/J1/2026/004", level: "JHS", className: "JHS 1", guardianName: "Anthony Koomson", guardianEmail: "koomson@eastfield.com", guardianPhone: "+233241230037" },
  { id: "st-j1-05", name: "Samuel Boakye", rollNumber: "EA/J1/2026/005", level: "JHS", className: "JHS 1", guardianName: "Ernest Boakye", guardianEmail: "samuelboakye@eastfield.com", guardianPhone: "+233241230135" },
  { id: "st-j1-06", name: "Evelyn Danquah", rollNumber: "EA/J1/2026/006", level: "JHS", className: "JHS 1", guardianName: "Ruth Danquah", guardianEmail: "evelyndanquah@eastfield.com", guardianPhone: "+233241230136" },
  { id: "st-j1-07", name: "Prince Agyeman", rollNumber: "EA/J1/2026/007", level: "JHS", className: "JHS 1", guardianName: "Godwin Agyeman", guardianEmail: "princeagyeman@eastfield.com", guardianPhone: "+233241230137" },
  { id: "st-j1-08", name: "Grace Osei-Bonsu", rollNumber: "EA/J1/2026/008", level: "JHS", className: "JHS 1", guardianName: "Doris Osei-Bonsu", guardianEmail: "graceoseibonsu@eastfield.com", guardianPhone: "+233241230138" },
  { id: "st-j1-09", name: "Daniel Kwakye", rollNumber: "EA/J1/2026/009", level: "JHS", className: "JHS 1", guardianName: "Francis Kwakye", guardianEmail: "danielkwakye@eastfield.com", guardianPhone: "+233241230139" },
  { id: "st-j1-10", name: "Mary Mensah", rollNumber: "EA/J1/2026/010", level: "JHS", className: "JHS 1", guardianName: "Beatrice Mensah", guardianEmail: "marymensah@eastfield.com", guardianPhone: "+233241230140" },
  { id: "st-j1-11", name: "Collins Donkor", rollNumber: "EA/J1/2026/011", level: "JHS", className: "JHS 1", guardianName: "Michael Donkor", guardianEmail: "collinsdonkor@eastfield.com", guardianPhone: "+233241230141" },
  { id: "st-j1-12", name: "Jennifer Appau", rollNumber: "EA/J1/2026/012", level: "JHS", className: "JHS 1", guardianName: "Priscilla Appau", guardianEmail: "jenniferappau@eastfield.com", guardianPhone: "+233241230142" },
  { id: "st-j1-13", name: "Victor Asamoah", rollNumber: "EA/J1/2026/013", level: "JHS", className: "JHS 1", guardianName: "Thomas Asamoah", guardianEmail: "victorasamoah@eastfield.com", guardianPhone: "+233241230143" },

  // JHS 2
  { id: "st-107", name: "Ebenezer Osei-Kofi", rollNumber: "EA/J2/2026/001", level: "JHS", className: "JHS 2", guardianName: "Daniel Osei-Kofi", guardianEmail: "daniel@osei-kofi.com", guardianPhone: "+233249876543" },
  { id: "st-108", name: "Akosua Mansah", rollNumber: "EA/J2/2026/002", level: "JHS", className: "JHS 2", guardianName: "Grace Mansah", guardianEmail: "grace@mansah.com", guardianPhone: "+233509876543" },
  { id: "st-j2-03", name: "Gideon Boakye", rollNumber: "EA/J2/2026/003", level: "JHS", className: "JHS 2", guardianName: "Stephen Boakye", guardianEmail: "gboakye@eastfield.com", guardianPhone: "+233241230038" },
  { id: "st-j2-04", name: "Rita Nti", rollNumber: "EA/J2/2026/004", level: "JHS", className: "JHS 2", guardianName: "Theresa Nti", guardianEmail: "nti@eastfield.com", guardianPhone: "+233241230039" },
  { id: "st-j2-05", name: "Kwabena Gyasi", rollNumber: "EA/J2/2026/005", level: "JHS", className: "JHS 2", guardianName: "Solomon Gyasi", guardianEmail: "kwabenagyasi@eastfield.com", guardianPhone: "+233241230144" },
  { id: "st-j2-06", name: "Millicent Darko", rollNumber: "EA/J2/2026/006", level: "JHS", className: "JHS 2", guardianName: "Agnes Darko", guardianEmail: "millicentdarko@eastfield.com", guardianPhone: "+233241230145" },
  { id: "st-j2-07", name: "Joseph Quaye", rollNumber: "EA/J2/2026/007", level: "JHS", className: "JHS 2", guardianName: "Bernard Quaye", guardianEmail: "josephquaye@eastfield.com", guardianPhone: "+233241230146" },
  { id: "st-j2-08", name: "Charity Amponsah", rollNumber: "EA/J2/2026/008", level: "JHS", className: "JHS 2", guardianName: "Rose Amponsah", guardianEmail: "charityamponsah@eastfield.com", guardianPhone: "+233241230147" },
  { id: "st-j2-09", name: "Emmanuel Arthur", rollNumber: "EA/J2/2026/009", level: "JHS", className: "JHS 2", guardianName: "Peter Arthur", guardianEmail: "emmanuelarthur@eastfield.com", guardianPhone: "+233241230148" },
  { id: "st-j2-10", name: "Comfort Owusu", rollNumber: "EA/J2/2026/010", level: "JHS", className: "JHS 2", guardianName: "Janet Owusu", guardianEmail: "comfortowusu@eastfield.com", guardianPhone: "+233241230149" },
  { id: "st-j2-11", name: "Solomon Baah", rollNumber: "EA/J2/2026/011", level: "JHS", className: "JHS 2", guardianName: "Charles Baah", guardianEmail: "solomonbaah@eastfield.com", guardianPhone: "+233241230150" },
  { id: "st-j2-12", name: "Doris Sarpong", rollNumber: "EA/J2/2026/012", level: "JHS", className: "JHS 2", guardianName: "Juliana Sarpong", guardianEmail: "dorissarpong@eastfield.com", guardianPhone: "+233241230151" },
  { id: "st-j2-13", name: "Peter Acheampong", rollNumber: "EA/J2/2026/013", level: "JHS", className: "JHS 2", guardianName: "Edward Acheampong", guardianEmail: "peteracheampong@eastfield.com", guardianPhone: "+233241230152" },

  // JHS 3
  { id: "st-j3-01", name: "Desmond Acheampong", rollNumber: "EA/J3/2026/001", level: "JHS", className: "JHS 3", guardianName: "Kwadwo Acheampong", guardianEmail: "acheampong@eastfield.com", guardianPhone: "+233241230040" },
  { id: "st-j3-02", name: "Christiana Owusu", rollNumber: "EA/J3/2026/002", level: "JHS", className: "JHS 3", guardianName: "Cecilia Owusu", guardianEmail: "cowusu@eastfield.com", guardianPhone: "+233241230041" },
  { id: "st-j3-03", name: "Bright Kwakye", rollNumber: "EA/J3/2026/003", level: "JHS", className: "JHS 3", guardianName: "David Kwakye", guardianEmail: "kwakye@eastfield.com", guardianPhone: "+233241230042" },
  { id: "st-j3-04", name: "Naomi Appiah", rollNumber: "EA/J3/2026/004", level: "JHS", className: "JHS 3", guardianName: "Gloria Appiah", guardianEmail: "appiah@eastfield.com", guardianPhone: "+233241230043" },
  { id: "st-j3-05", name: "Isaac Ofori", rollNumber: "EA/J3/2026/005", level: "JHS", className: "JHS 3", guardianName: "Robert Ofori", guardianEmail: "isaacofori@eastfield.com", guardianPhone: "+233241230153" },
  { id: "st-j3-06", name: "Florence Mensah", rollNumber: "EA/J3/2026/006", level: "JHS", className: "JHS 3", guardianName: "Martha Mensah", guardianEmail: "florencemensah@eastfield.com", guardianPhone: "+233241230154" },
  { id: "st-j3-07", name: "Anthony Boateng", rollNumber: "EA/J3/2026/007", level: "JHS", className: "JHS 3", guardianName: "Samuel Boateng", guardianEmail: "anthonyboateng@eastfield.com", guardianPhone: "+233241230155" },
  { id: "st-j3-08", name: "Sandra Asare", rollNumber: "EA/J3/2026/008", level: "JHS", className: "JHS 3", guardianName: "Victoria Asare", guardianEmail: "sandraasare@eastfield.com", guardianPhone: "+233241230156" },
  { id: "st-j3-09", name: "Kelvin Addai", rollNumber: "EA/J3/2026/009", level: "JHS", className: "JHS 3", guardianName: "Francis Addai", guardianEmail: "kelvinaddai@eastfield.com", guardianPhone: "+233241230157" },
  { id: "st-j3-10", name: "Abigail Tetteh", rollNumber: "EA/J3/2026/010", level: "JHS", className: "JHS 3", guardianName: "Elizabeth Tetteh", guardianEmail: "abigailtetteh@eastfield.com", guardianPhone: "+233241230158" },
  { id: "st-j3-11", name: "Stephen Danquah", rollNumber: "EA/J3/2026/011", level: "JHS", className: "JHS 3", guardianName: "Godwin Danquah", guardianEmail: "stephendanquah@eastfield.com", guardianPhone: "+233241230159" },
  { id: "st-j3-12", name: "Georgina Badu", rollNumber: "EA/J3/2026/012", level: "JHS", className: "JHS 3", guardianName: "Doris Badu", guardianEmail: "georginabadu@eastfield.com", guardianPhone: "+233241230160" },
  { id: "st-j3-13", name: "Michael Forson", rollNumber: "EA/J3/2026/013", level: "JHS", className: "JHS 3", guardianName: "Eric Forson", guardianEmail: "michaelforson@eastfield.com", guardianPhone: "+233241230161" }
];

export const INITIAL_GRADING_SCALE: GradingScaleRule[] = [
  { grade: 'A1', minScore: 80, maxScore: 100, gpa: 4.0, remarks: 'HIGHEST' },
  { grade: 'B2', minScore: 70, maxScore: 79.9, gpa: 3.5, remarks: 'HIGHER' },
  { grade: 'B3', minScore: 60, maxScore: 69.9, gpa: 3.0, remarks: 'HIGH' },
  { grade: 'C4', minScore: 55, maxScore: 59.9, gpa: 2.5, remarks: 'HIGH AVERAGE' },
  { grade: 'C5', minScore: 50, maxScore: 54.9, gpa: 2.0, remarks: 'AVERAGE' },
  { grade: 'C6', minScore: 40, maxScore: 49.9, gpa: 1.5, remarks: 'LOW AVERAGE' },
  { grade: 'D7', minScore: 30, maxScore: 39.9, gpa: 1.0, remarks: 'LOW' },
  { grade: 'E8', minScore: 20, maxScore: 29.9, gpa: 0.5, remarks: 'LOWER' },
  { grade: 'F9', minScore: 0, maxScore: 19.9, gpa: 0.0, remarks: 'LOWEST' }
];

export const DEFAULT_REPORT_CONFIG: ReportConfig = {
  schoolName: 'Eastfield Academy',
  schoolYear: '2025/2026',
  term: 'Term 1',
  gradingScale: INITIAL_GRADING_SCALE,
  principalName: 'Dr. Evelyn Asare-Bediako',
  schoolLogoText: 'EA',
  classScoreWeight: 50, // 50% Class Score
  examScoreWeight: 50,  // 50% Terminal Exams
  selectedTemplate: 'dynamic',
  reopeningDate: '2026-09-15',
  autoPromoteOnReopening: false,
  schoolMotto: 'Knowledge, Character & Excellence',
  customNoticeNote: '',
  showPositionInClass: true,
  showConductColumn: true,
  showAttendanceSection: true,
  accentColor: '#1e1b4b',
  watermarkText: 'EASTFIELD ACADEMY'
};

export const INITIAL_USERS: User[] = [
  // Nursery
  { id: "tch-01", name: "Kojo Mensah (Nursery 1)", email: "nursery@eastfield.com", role: "TEACHER", password: "password123", level: "NURSERY", classes: ["Nursery 1"], subjects: ["sub-n-lit", "sub-n-num"] },
  { id: "tch-n2", name: "Esi Agyeman (Nursery 2)", email: "nursery2@eastfield.com", role: "TEACHER", password: "password123", level: "NURSERY", classes: ["Nursery 2"], subjects: ["sub-n-cr", "sub-n-pho"] },
  // Kindergarten
  { id: "tch-k1", name: "Akosua Boakye (KG 1)", email: "kg1@eastfield.com", role: "TEACHER", password: "password123", level: "KINDERGARTEN", classes: ["Kindergarten 1"], subjects: ["sub-k-lit", "sub-k-num"] },
  { id: "tch-k2", name: "Kofi Osei (KG 2)", email: "kg2@eastfield.com", role: "TEACHER", password: "password123", level: "KINDERGARTEN", classes: ["Kindergarten 2"], subjects: ["sub-k-owop", "sub-k-ca"] },
  // Primary
  { id: "tch-02", name: "Ama Serwaa (Primary 1)", email: "primary@eastfield.com", role: "TEACHER", password: "password123", level: "PRIMARY", classes: ["Primary 1"], subjects: ["sub-p-math", "sub-p-eng"] },
  { id: "tch-p2", name: "Kwame Nkrumah (Primary 2)", email: "primary2@eastfield.com", role: "TEACHER", password: "password123", level: "PRIMARY", classes: ["Primary 2"], subjects: ["sub-p-math", "sub-p-eng"] },
  { id: "tch-p3", name: "Abena Darko (Primary 3)", email: "primary3@eastfield.com", role: "TEACHER", password: "password123", level: "PRIMARY", classes: ["Primary 3"], subjects: ["sub-p-math", "sub-p-sci"] },
  { id: "tch-p4", name: "Yaa Asantewaa (Primary 4)", email: "primary4@eastfield.com", role: "TEACHER", password: "password123", level: "PRIMARY", classes: ["Primary 4"], subjects: ["sub-p-eng", "sub-p-soc"] },
  { id: "tch-p5", name: "Kofi Addo (Primary 5)", email: "primary5@eastfield.com", role: "TEACHER", password: "password123", level: "PRIMARY", classes: ["Primary 5"], subjects: ["sub-p-math", "sub-p-rme"] },
  { id: "tch-p6", name: "Adwoa Mansa (Primary 6)", email: "primary6@eastfield.com", role: "TEACHER", password: "password123", level: "PRIMARY", classes: ["Primary 6"], subjects: ["sub-p-eng", "sub-p-ict"] },
  // JHS (Unassigned initially so Admin can assign each class teacher)
  { id: "tch-03", name: "Kwesi Appiah", email: "jhs@eastfield.com", role: "TEACHER", password: "password123", level: "JHS", classes: [], subjects: ["sub-j-math", "sub-j-ca"] },
  { id: "tch-04", name: "Abena Gyamfi", email: "jhs2@eastfield.com", role: "TEACHER", password: "password123", level: "JHS", classes: [], subjects: ["sub-j-eng", "sub-j-sci"] },
  { id: "tch-05", name: "Yaw Asamoah", email: "jhs3@eastfield.com", role: "TEACHER", password: "password123", level: "JHS", classes: [], subjects: ["sub-j-soc", "sub-j-rme"] }
];

function getInitialGradeData(): Grade[] {
  const list: Grade[] = [];
  const subjectsByLevel: Record<string, Subject[]> = {
    NURSERY: INITIAL_SUBJECTS.filter(s => s.level === 'NURSERY'),
    KINDERGARTEN: INITIAL_SUBJECTS.filter(s => s.level === 'KINDERGARTEN'),
    PRIMARY: INITIAL_SUBJECTS.filter(s => s.level === 'PRIMARY'),
    JHS: INITIAL_SUBJECTS.filter(s => s.level === 'JHS')
  };

  const terms = ['Term 3', 'Term 1'];
  
  INITIAL_STUDENTS.forEach((st, sIdx) => {
    const subs = subjectsByLevel[st.level] || [];
    
    // Determine teacher ID
    let teacherId = 'tch-01';
    if (st.level === 'NURSERY') teacherId = st.className.includes('2') ? 'tch-n2' : 'tch-01';
    else if (st.level === 'KINDERGARTEN') teacherId = st.className.includes('2') ? 'tch-k2' : 'tch-k1';
    else if (st.level === 'PRIMARY') {
      if (st.className.includes('2')) teacherId = 'tch-p2';
      else if (st.className.includes('3')) teacherId = 'tch-p3';
      else if (st.className.includes('4')) teacherId = 'tch-p4';
      else if (st.className.includes('5')) teacherId = 'tch-p5';
      else if (st.className.includes('6')) teacherId = 'tch-p6';
      else teacherId = 'tch-02';
    } else if (st.level === 'JHS') {
      if (st.className.includes('2')) teacherId = 'tch-04';
      else if (st.className.includes('3')) teacherId = 'tch-05';
      else teacherId = 'tch-03';
    }

    terms.forEach((term, tIdx) => {
      subs.forEach((sub, subIdx) => {
        const seed = (sIdx * 17) + (subIdx * 11) + (tIdx * 7);
        let classScore = 36 + (seed % 12);
        let examScore = 38 + ((seed * 3) % 11);

        if (st.name.toLowerCase().includes('messiah') || st.name.toLowerCase().includes('kwame asante')) {
          classScore = 44 + (seed % 5);
          examScore = 46 + ((seed * 2) % 4);
        } else if (sIdx % 4 === 1) {
          classScore = 41 + (seed % 8);
          examScore = 42 + ((seed * 2) % 7);
        }

        classScore = Math.min(50, Math.max(25, classScore));
        examScore = Math.min(50, Math.max(25, examScore));
        const totalScore = classScore + examScore;

        let gradeLetter = 'B2';
        let remarks = 'VERY GOOD';
        let nurseryRemark: 'MO' | 'O' | 'S' | 'NA' | undefined = undefined;

        if (st.level === 'NURSERY') {
          if (totalScore >= 80) {
            nurseryRemark = 'MO';
            gradeLetter = 'A1';
            remarks = 'MO';
          } else if (totalScore >= 65) {
            nurseryRemark = 'O';
            gradeLetter = 'B2';
            remarks = 'O';
          } else {
            nurseryRemark = 'S';
            gradeLetter = 'C4';
            remarks = 'S';
          }
        } else {
          if (totalScore >= 80) {
            gradeLetter = 'A1';
            remarks = 'EXCELLENT';
          } else if (totalScore >= 70) {
            gradeLetter = 'B2';
            remarks = 'VERY GOOD';
          } else if (totalScore >= 60) {
            gradeLetter = 'B3';
            remarks = 'GOOD';
          } else if (totalScore >= 55) {
            gradeLetter = 'C4';
            remarks = 'HIGH AVERAGE';
          } else {
            gradeLetter = 'C5';
            remarks = 'AVERAGE';
          }
        }

        list.push({
          studentId: st.id,
          subjectId: sub.id,
          classScore,
          examScore,
          totalScore,
          gradeLetter,
          remarks,
          nurseryRemark,
          term,
          year: '2025/2026',
          teacherId,
          updatedAt: new Date().toISOString()
        });
      });
    });
  });

  return list;
}

export const INITIAL_GRADES: Grade[] = getInitialGradeData();

function getInitialAttendanceData(): Attendance[] {
  const list: Attendance[] = [];
  const terms = ['Term 3', 'Term 1'];
  
  INITIAL_STUDENTS.forEach((st, idx) => {
    terms.forEach(term => {
      const daysPresent = 65 + ((idx * 3) % 6);
      list.push({
        studentId: st.id,
        term,
        year: '2025/2026',
        totalDays: 70,
        daysPresent,
        remarks: daysPresent >= 69 ? 'Outstanding punctuality and exemplary conduct.' : 'Very regular, hardworking, and attentive in class.',
        teacherId: 'tch-01',
        updatedAt: new Date().toISOString()
      });
    });
  });

  return list;
}

export const INITIAL_ATTENDANCE: Attendance[] = getInitialAttendanceData();

export const INITIAL_FEE_PAYMENTS: FeePayment[] = [];

export const DEFAULT_INVENTORY_DATA: ClassroomInventoryRecord[] = [];

export const DEFAULT_BOOK_STOCK_ITEMS: BookStockItem[] = [
  // Textbooks
  {
    id: 'bk-tb-01',
    title: 'Aki-Ola Core Mathematics for JHS',
    category: 'Textbook',
    publication: 'Aki-Ola Publications',
    subjectType: 'Mathematics',
    targetClass: 'JHS 1 - JHS 3',
    unitPrice: 85.0,
    costPrice: 65.0,
    quantityInStock: 150,
    quantitySold: 42,
    quantityRemaining: 108,
    lowStockThreshold: 20,
    shelfLocation: 'Shelf A-1 (Math)',
    notes: 'Approved NaCCA curriculum textbook for Junior High School.',
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z'
  },
  {
    id: 'bk-tb-02',
    title: 'Approachers Integrated Science for JHS',
    category: 'Textbook',
    publication: 'Approachers Series',
    subjectType: 'Science',
    targetClass: 'JHS 1 - JHS 3',
    unitPrice: 90.0,
    costPrice: 70.0,
    quantityInStock: 120,
    quantitySold: 35,
    quantityRemaining: 85,
    lowStockThreshold: 15,
    shelfLocation: 'Shelf A-2 (Science)',
    notes: 'Complete with practical experiments and examination review exercises.',
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z'
  },
  {
    id: 'bk-tb-03',
    title: 'Alpha & Omega English Language for Primary',
    category: 'Textbook',
    publication: 'Alpha & Omega',
    subjectType: 'English Language',
    targetClass: 'Primary 4 - Primary 6',
    unitPrice: 65.0,
    costPrice: 48.0,
    quantityInStock: 100,
    quantitySold: 28,
    quantityRemaining: 72,
    lowStockThreshold: 15,
    shelfLocation: 'Shelf B-1 (English)',
    notes: 'Comprehensive grammar, comprehension, and vocabulary builder.',
    createdAt: '2026-01-12T08:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z'
  },
  {
    id: 'bk-tb-04',
    title: 'Excellence Social Studies for Primary Schools',
    category: 'Textbook',
    publication: 'Excellence Publications',
    subjectType: 'Social Studies',
    targetClass: 'Primary 1 - Primary 6',
    unitPrice: 60.0,
    costPrice: 45.0,
    quantityInStock: 80,
    quantitySold: 18,
    quantityRemaining: 62,
    lowStockThreshold: 15,
    shelfLocation: 'Shelf B-2 (Social)',
    notes: 'Cultural studies, history, and citizenship education.',
    createdAt: '2026-01-12T08:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z'
  },
  {
    id: 'bk-tb-05',
    title: 'Winmat Computing for Basic Schools',
    category: 'Textbook',
    publication: 'Winmat Publishers',
    subjectType: 'Computing / ICT',
    targetClass: 'All Classes',
    unitPrice: 75.0,
    costPrice: 55.0,
    quantityInStock: 90,
    quantitySold: 25,
    quantityRemaining: 65,
    lowStockThreshold: 15,
    shelfLocation: 'Shelf C-1 (ICT)',
    notes: 'Hands-on practical computing and algorithmic thinking.',
    createdAt: '2026-01-15T08:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z'
  },
  {
    id: 'bk-tb-06',
    title: 'Sedco Religious & Moral Education (RME)',
    category: 'Textbook',
    publication: 'Sedco Publishing',
    subjectType: 'Religious and Moral Education',
    targetClass: 'Primary 1 - Primary 6',
    unitPrice: 55.0,
    costPrice: 40.0,
    quantityInStock: 70,
    quantitySold: 14,
    quantityRemaining: 56,
    lowStockThreshold: 15,
    shelfLocation: 'Shelf C-2 (RME)',
    notes: 'Moral values, social responsibility and world religions.',
    createdAt: '2026-01-15T08:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z'
  },
  {
    id: 'bk-tb-07',
    title: 'Pearson Akuapem Twi Reader',
    category: 'Textbook',
    publication: 'Pearson Ghana',
    subjectType: 'Akuapem Twi',
    targetClass: 'All Classes',
    unitPrice: 50.0,
    costPrice: 38.0,
    quantityInStock: 60,
    quantitySold: 12,
    quantityRemaining: 48,
    lowStockThreshold: 10,
    shelfLocation: 'Shelf D-1 (Languages)',
    notes: 'Graded local Ghanaian language reader.',
    createdAt: '2026-01-18T08:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z'
  },

  // Customised Exercise Books
  {
    id: 'bk-eb-01',
    title: 'Custom Branded 40-Page Exercise Book (Single Line)',
    category: 'Customised Exercise Book',
    publication: 'Eastfield Academy Press / Crest Edition',
    subjectType: 'General / Writing',
    targetClass: 'All Classes',
    unitPrice: 8.0,
    costPrice: 5.5,
    quantityInStock: 1200,
    quantitySold: 480,
    quantityRemaining: 720,
    lowStockThreshold: 100,
    shelfLocation: 'Main Store Bay 1',
    notes: 'Full-colour embossed school crest cover with student bio box on back.',
    createdAt: '2026-01-05T08:00:00.000Z',
    updatedAt: '2026-09-02T08:00:00.000Z'
  },
  {
    id: 'bk-eb-02',
    title: 'Custom Branded 60-Page Exercise Book (Broad Line)',
    category: 'Customised Exercise Book',
    publication: 'Eastfield Academy Press / Crest Edition',
    subjectType: 'English / Literacy',
    targetClass: 'Kindergarten & Primary 1-3',
    unitPrice: 10.0,
    costPrice: 7.0,
    quantityInStock: 800,
    quantitySold: 320,
    quantityRemaining: 480,
    lowStockThreshold: 80,
    shelfLocation: 'Main Store Bay 1',
    notes: 'Special wide ruling for early childhood handwriting development.',
    createdAt: '2026-01-05T08:00:00.000Z',
    updatedAt: '2026-09-02T08:00:00.000Z'
  },
  {
    id: 'bk-eb-03',
    title: 'Custom Branded 80-Page Exercise Book (Single Line)',
    category: 'Customised Exercise Book',
    publication: 'Eastfield Academy Press / Crest Edition',
    subjectType: 'General / Notes',
    targetClass: 'Primary 4 - JHS 3',
    unitPrice: 12.0,
    costPrice: 8.5,
    quantityInStock: 950,
    quantitySold: 410,
    quantityRemaining: 540,
    lowStockThreshold: 90,
    shelfLocation: 'Main Store Bay 2',
    notes: 'High-gsm woodfree paper with durable coated school crest cover.',
    createdAt: '2026-01-05T08:00:00.000Z',
    updatedAt: '2026-09-02T08:00:00.000Z'
  },
  {
    id: 'bk-eb-04',
    title: 'Custom Branded Math Grid Exercise Book (Square Ruled)',
    category: 'Customised Exercise Book',
    publication: 'Eastfield Academy Press / Crest Edition',
    subjectType: 'Mathematics',
    targetClass: 'All Classes',
    unitPrice: 10.0,
    costPrice: 7.0,
    quantityInStock: 750,
    quantitySold: 260,
    quantityRemaining: 490,
    lowStockThreshold: 75,
    shelfLocation: 'Main Store Bay 2',
    notes: 'Standard 7mm square grids for arithmetic, geometry and tabular calculations.',
    createdAt: '2026-01-05T08:00:00.000Z',
    updatedAt: '2026-09-02T08:00:00.000Z'
  },
  {
    id: 'bk-eb-05',
    title: 'Custom Branded Drawing & Sketch Book',
    category: 'Customised Exercise Book',
    publication: 'Eastfield Academy Press / Crest Edition',
    subjectType: 'Creative Arts & Design',
    targetClass: 'All Classes',
    unitPrice: 15.0,
    costPrice: 10.5,
    quantityInStock: 400,
    quantitySold: 95,
    quantityRemaining: 305,
    lowStockThreshold: 40,
    shelfLocation: 'Main Store Bay 3',
    notes: 'Cartridge drawing paper for art, shading, and technical sketching.',
    createdAt: '2026-01-08T08:00:00.000Z',
    updatedAt: '2026-09-02T08:00:00.000Z'
  },
  {
    id: 'bk-eb-06',
    title: 'Custom Branded 120-Page Hardcover Notebook',
    category: 'Customised Exercise Book',
    publication: 'Eastfield Academy Press / Crest Edition',
    subjectType: 'General / JHS',
    targetClass: 'JHS 1 - JHS 3',
    unitPrice: 22.0,
    costPrice: 16.0,
    quantityInStock: 350,
    quantitySold: 110,
    quantityRemaining: 240,
    lowStockThreshold: 30,
    shelfLocation: 'Cabinet 3',
    notes: 'Reinforced sewn hardback spine for major notes and record keeping.',
    createdAt: '2026-01-08T08:00:00.000Z',
    updatedAt: '2026-09-02T08:00:00.000Z'
  },

  // Customised Textbooks
  {
    id: 'bk-ct-01',
    title: 'Eastfield Custom Phonics & Early Literacy Workbook',
    category: 'Customised Textbook',
    publication: 'Eastfield Academy Press',
    subjectType: 'Literacy / Language',
    targetClass: 'Kindergarten & Primary 1',
    unitPrice: 45.0,
    costPrice: 32.0,
    quantityInStock: 200,
    quantitySold: 78,
    quantityRemaining: 122,
    lowStockThreshold: 25,
    shelfLocation: 'Shelf E-1 (Custom)',
    notes: 'Specially authored school curriculum workbook with audio-visual phonics drills.',
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: '2026-09-02T08:00:00.000Z'
  },
  {
    id: 'bk-ct-02',
    title: 'Eastfield Custom Mental Math & Speed Drills Booklet',
    category: 'Customised Textbook',
    publication: 'Eastfield Academy Press',
    subjectType: 'Mathematics',
    targetClass: 'Primary 1 - Primary 6',
    unitPrice: 40.0,
    costPrice: 28.0,
    quantityInStock: 250,
    quantitySold: 95,
    quantityRemaining: 155,
    lowStockThreshold: 30,
    shelfLocation: 'Shelf E-2 (Custom)',
    notes: 'Daily mental computation drills, times table mastery and olympiad problems.',
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: '2026-09-02T08:00:00.000Z'
  },
  {
    id: 'bk-ct-03',
    title: 'Eastfield ICT Practical Lab Guide & Workbook',
    category: 'Customised Textbook',
    publication: 'Eastfield Academy Press',
    subjectType: 'Computing / ICT',
    targetClass: 'Primary 4 - JHS 3',
    unitPrice: 48.0,
    costPrice: 34.0,
    quantityInStock: 180,
    quantitySold: 60,
    quantityRemaining: 120,
    lowStockThreshold: 20,
    shelfLocation: 'Shelf E-3 (Custom)',
    notes: 'Step-by-step practical computer lab manual including typing and coding.',
    createdAt: '2026-01-12T08:00:00.000Z',
    updatedAt: '2026-09-02T08:00:00.000Z'
  }
];

export const DEFAULT_BOOK_SALES: BookSaleRecord[] = [
  {
    id: 'sale-001',
    receiptNumber: 'BK-2026-0001',
    buyerName: 'Charles Osei',
    buyerType: 'Parent',
    studentId: 'st-105',
    className: 'Nursery 1',
    contactNumber: '+233551234567',
    items: [
      {
        bookId: 'bk-eb-01',
        title: 'Custom Branded 40-Page Exercise Book (Single Line)',
        category: 'Customised Exercise Book',
        publication: 'Eastfield Academy Press / Crest Edition',
        subjectType: 'General / Writing',
        quantity: 5,
        unitPrice: 8.0,
        totalPrice: 40.0
      },
      {
        bookId: 'bk-eb-02',
        title: 'Custom Branded 60-Page Exercise Book (Broad Line)',
        category: 'Customised Exercise Book',
        publication: 'Eastfield Academy Press / Crest Edition',
        subjectType: 'English / Literacy',
        quantity: 4,
        unitPrice: 10.0,
        totalPrice: 40.0
      },
      {
        bookId: 'bk-ct-01',
        title: 'Eastfield Custom Phonics & Early Literacy Workbook',
        category: 'Customised Textbook',
        publication: 'Eastfield Academy Press',
        subjectType: 'Literacy / Language',
        quantity: 1,
        unitPrice: 45.0,
        totalPrice: 45.0
      }
    ],
    subtotal: 125.0,
    discount: 0,
    totalAmount: 125.0,
    paymentMethod: 'Cash',
    paymentReference: 'CSH-001',
    saleDate: '2026-09-02',
    saleTime: '08:45',
    recordedBy: 'Administrator',
    remarks: 'Term 1 starter pack bundle for Abena Osei',
    createdAt: '2026-09-02T08:45:00.000Z'
  },
  {
    id: 'sale-002',
    receiptNumber: 'BK-2026-0002',
    buyerName: 'Seth Ofori',
    buyerType: 'Parent',
    studentId: 'st-106',
    className: 'Kindergarten 1',
    contactNumber: '+233241112233',
    items: [
      {
        bookId: 'bk-eb-01',
        title: 'Custom Branded 40-Page Exercise Book (Single Line)',
        category: 'Customised Exercise Book',
        publication: 'Eastfield Academy Press / Crest Edition',
        subjectType: 'General / Writing',
        quantity: 6,
        unitPrice: 8.0,
        totalPrice: 48.0
      },
      {
        bookId: 'bk-eb-04',
        title: 'Custom Branded Math Grid Exercise Book (Square Ruled)',
        category: 'Customised Exercise Book',
        publication: 'Eastfield Academy Press / Crest Edition',
        subjectType: 'Mathematics',
        quantity: 3,
        unitPrice: 10.0,
        totalPrice: 30.0
      },
      {
        bookId: 'bk-eb-05',
        title: 'Custom Branded Drawing & Sketch Book',
        category: 'Customised Exercise Book',
        publication: 'Eastfield Academy Press / Crest Edition',
        subjectType: 'Creative Arts & Design',
        quantity: 1,
        unitPrice: 15.0,
        totalPrice: 15.0
      }
    ],
    subtotal: 93.0,
    discount: 3.0,
    totalAmount: 90.0,
    paymentMethod: 'Mobile Money',
    paymentReference: 'MM-9923847291',
    saleDate: '2026-09-02',
    saleTime: '09:15',
    recordedBy: 'Administrator',
    remarks: 'Paid via MTN MoMo',
    createdAt: '2026-09-02T09:15:00.000Z'
  },
  {
    id: 'sale-003',
    receiptNumber: 'BK-2026-0003',
    buyerName: 'Madam Mansa Adjei',
    buyerType: 'Parent',
    studentId: '',
    className: 'JHS 2',
    contactNumber: '+233208765432',
    items: [
      {
        bookId: 'bk-tb-01',
        title: 'Aki-Ola Core Mathematics for JHS',
        category: 'Textbook',
        publication: 'Aki-Ola Publications',
        subjectType: 'Mathematics',
        quantity: 1,
        unitPrice: 85.0,
        totalPrice: 85.0
      },
      {
        bookId: 'bk-tb-02',
        title: 'Approachers Integrated Science for JHS',
        category: 'Textbook',
        publication: 'Approachers Series',
        subjectType: 'Science',
        quantity: 1,
        unitPrice: 90.0,
        totalPrice: 90.0
      },
      {
        bookId: 'bk-eb-03',
        title: 'Custom Branded 80-Page Exercise Book (Single Line)',
        category: 'Customised Exercise Book',
        publication: 'Eastfield Academy Press / Crest Edition',
        subjectType: 'General / Notes',
        quantity: 4,
        unitPrice: 12.0,
        totalPrice: 48.0
      }
    ],
    subtotal: 223.0,
    discount: 0,
    totalAmount: 223.0,
    paymentMethod: 'Cash',
    paymentReference: 'CSH-003',
    saleDate: '2026-09-02',
    saleTime: '09:40',
    recordedBy: 'Administrator',
    remarks: 'JHS standard books purchase',
    createdAt: '2026-09-02T09:40:00.000Z'
  }
];
