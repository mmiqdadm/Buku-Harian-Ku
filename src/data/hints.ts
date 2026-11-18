export type HintCategory = 'semua' | 'kegiatan' | 'perasaan' | 'keluarga' | 'imajinasi';

export interface WritingHint {
  id: string;
  category: Exclude<HintCategory, 'semua'>;
  question: string;
  followUp: string;
}

export const HINT_CATEGORIES: { id: HintCategory; label: string }[] = [
  { id: 'semua', label: 'Semua Ide' },
  { id: 'kegiatan', label: 'Kegiatan Hari Ini' },
  { id: 'perasaan', label: 'Perasaan' },
  { id: 'keluarga', label: 'Keluarga & Teman' },
  { id: 'imajinasi', label: 'Cerita & Imajinasi' },
];

export const WRITING_HINTS: WritingHint[] = [
  {
    id: 'h1',
    category: 'kegiatan',
    question: 'Apa yang menurutmu paling seru hari ini?',
    followUp: 'Ceritakan kejadiannya dari awal sampai akhir.',
  },
  {
    id: 'h2',
    category: 'kegiatan',
    question: 'Apa saja yang kamu lakukan pagi hari tadi?',
    followUp: 'Mulai dari bangun tidur, sarapan, sampai kegiatan pagimu.',
  },
  {
    id: 'h3',
    category: 'kegiatan',
    question: 'Siang tadi kamu makan apa?',
    followUp: 'Bagaimana rasanya, dan siapa yang memasak atau membelinya?',
  },
  {
    id: 'h4',
    category: 'keluarga',
    question: 'Siapa yang membuatmu bahagia hari ini?',
    followUp: 'Apa yang dia lakukan atau katakan kepadamu?',
  },
  {
    id: 'h5',
    category: 'kegiatan',
    question: 'Permainan apa yang kamu mainkan hari ini?',
    followUp: 'Kamu bermain bersama siapa, dan bagian mana yang paling asyik?',
  },
  {
    id: 'h6',
    category: 'kegiatan',
    question: 'Apakah ada hal baru yang kamu pelajari hari ini?',
    followUp: 'Coba jelaskan hal baru itu dengan bahasamu sendiri.',
  },
  {
    id: 'h7',
    category: 'perasaan',
    question: 'Bagaimana perasaanmu hari ini secara keseluruhan?',
    followUp: 'Apa alasan yang membuatmu merasa seperti itu?',
  },
  {
    id: 'h8',
    category: 'perasaan',
    question: 'Ada kejadian lucu yang membuatmu tertawa hari ini?',
    followUp: 'Ceritakan bagian yang paling bikin kamu ketawa.',
  },
  {
    id: 'h9',
    category: 'perasaan',
    question: 'Apakah hari ini ada sesuatu yang terasa sulit bagimu?',
    followUp: 'Bagaimana caramu menghadapinya atau siapa yang membantumu?',
  },
  {
    id: 'h10',
    category: 'keluarga',
    question: 'Kebaikan kecil apa yang kamu lakukan hari ini?',
    followUp: 'Misalnya membantu orang tua, merapikan mainan, atau berbagi dengan adik atau kakak.',
  },
  {
    id: 'h11',
    category: 'keluarga',
    question: 'Apa hal menyenangkan yang kamu lakukan bersama kakak atau adikmu hari ini?',
    followUp: 'Atau cerita seru apa yang kalian obrolkan bersama?',
  },
  {
    id: 'h12',
    category: 'kegiatan',
    question: 'Buku, cerita, atau tontonan apa yang kamu nikmati hari ini?',
    followUp: 'Bagian atau tokoh mana yang paling kamu suka?',
  },
  {
    id: 'h13',
    category: 'kegiatan',
    question: 'Hewan, tanaman, atau benda menarik apa yang kamu lihat hari ini?',
    followUp: 'Di mana kamu melihatnya dan seperti apa bentuknya?',
  },
  {
    id: 'h14',
    category: 'perasaan',
    question: 'Hal apa yang paling kamu syukuri hari ini?',
    followUp: 'Boleh hal kecil seperti cuaca yang cerah atau makanan yang enak.',
  },
  {
    id: 'h15',
    category: 'imajinasi',
    question: 'Kalau hari ini bisa diulang satu bagian saja, bagian mana yang kamu pilih?',
    followUp: 'Kenapa kamu ingin mengulang momen itu?',
  },
  {
    id: 'h16',
    category: 'imajinasi',
    question: 'Kalau kamu bisa pergi ke tempat mana saja besok, kamu mau ke mana?',
    followUp: 'Kamu ingin melakukan apa setibanya di sana?',
  },
  {
    id: 'h17',
    category: 'kegiatan',
    question: 'Tugas atau pekerjaan apa yang berhasil kamu selesaikan hari ini?',
    followUp: 'Bagaimana rasanya setelah selesai mengerjakannya?',
  },
  {
    id: 'h18',
    category: 'keluarga',
    question: 'Obrolan apa yang paling kamu ingat bersama Ayah atau Ibu hari ini?',
    followUp: 'Apakah ada cerita atau nasihat yang menarik?',
  },
  {
    id: 'h19',
    category: 'perasaan',
    question: 'Apakah hari ini kamu sempat merasa kaget atau penasaran?',
    followUp: 'Hal apa yang membuatmu kaget atau penasaran itu?',
  },
  {
    id: 'h20',
    category: 'kegiatan',
    question: 'Seperti apa cuaca hari ini di luar rumah?',
    followUp: 'Apakah cuacanya cocok dengan kegiatan yang kamu lakukan?',
  },
  {
    id: 'h21',
    category: 'kegiatan',
    question: 'Camilan atau minuman apa yang kamu nikmati hari ini?',
    followUp: 'Kalau boleh memberi nilai dari 1 sampai 10, nilainya berapa?',
  },
  {
    id: 'h22',
    category: 'keluarga',
    question: 'Teman mana yang kamu temui atau ingat hari ini?',
    followUp: 'Apa yang kalian lakukan bersama atau ingin kalian lakukan nanti?',
  },
  {
    id: 'h23',
    category: 'imajinasi',
    question: 'Kalau hari ini punya judul seperti buku cerita, apa judul yang cocok?',
    followUp: 'Lalu tuliskan isi ceritanya di bawah judul itu.',
  },
  {
    id: 'h24',
    category: 'imajinasi',
    question: 'Andai kamu bisa menciptakan satu mainan baru hari ini, mainan apa itu?',
    followUp: 'Seperti apa cara memainkannya?',
  },
  {
    id: 'h25',
    category: 'kegiatan',
    question: 'Kegiatan sore apa yang kamu lakukan tadi?',
    followUp: 'Apakah di dalam rumah atau bermain di luar?',
  },
  {
    id: 'h26',
    category: 'perasaan',
    question: 'Kapan momen paling tenang yang kamu rasakan hari ini?',
    followUp: 'Apa yang sedang kamu lakukan saat itu?',
  },
  {
    id: 'h27',
    category: 'keluarga',
    question: 'Apakah hari ini ada orang yang menolongmu?',
    followUp: 'Bagaimana caranya menolongmu dan apa yang ingin kamu ucapkan padanya?',
  },
  {
    id: 'h28',
    category: 'imajinasi',
    question: 'Besok, hal apa yang paling ingin kamu lakukan?',
    followUp: 'Apa saja yang perlu kamu siapkan untuk besok?',
  },
  {
    id: 'h29',
    category: 'kegiatan',
    question: 'Apakah hari ini kamu menggambar, membuat kerajinan, atau menyusun sesuatu?',
    followUp: 'Ceritakan hasil karyamu, kamu juga bisa melampirkan fotonya.',
  },
  {
    id: 'h30',
    category: 'perasaan',
    question: 'Hal apa yang hari ini membuatmu merasa bangga pada dirimu sendiri?',
    followUp: 'Sekecil apa pun keberhasilanmu, pantas dicatat di buku harian.',
  },
];
