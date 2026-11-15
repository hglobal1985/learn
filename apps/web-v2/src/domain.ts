export const ranks = [
  "不限獎銜",
  "銀章",
  "金章",
  "白金",
  "翡翠",
  "鑽石",
] as const;
export type Rank = (typeof ranks)[number];
export type Member = {
  id: string;
  name: string;
  rank: Rank;
  role: "student" | "admin";
};
export type Lesson = { id: string; title: string; minutes: number };
export type Course = {
  id: string;
  title: string;
  subtitle: string;
  teacher: string;
  category: string;
  price: number;
  rank: Rank;
  theme: string;
  lessons: Lesson[];
  published: boolean;
};
export type Order = {
  id: string;
  memberId: string;
  items: { courseId: string; title: string; price: number }[];
  total: number;
  status: "opened" | "pending" | "rejected";
  createdAt: string;
  reason?: string;
};
export type Notice = {
  id: string;
  recipient: string;
  title: string;
  body: string;
  href: string;
  read: boolean;
};
export type State = {
  version: 1;
  member: Member | null;
  courses: Course[];
  cart: string[];
  orders: Order[];
  notices: Notice[];
  favorites: string[];
  completed: Record<string, string[]>;
  notes: Record<string, string>;
  preferences: { reminders: boolean };
};
const titles = [
  [
    "start",
    "把目標變成每天的行動",
    "從第一步開始，找到自己的成長節奏",
    "寰宇學習團隊",
    "自我成長",
    0,
    "不限獎銜",
    "sage",
  ],
  [
    "talk",
    "讓每一次溝通，都更有力量",
    "從傾聽到表達，建立真誠的連結",
    "寰宇培訓團隊",
    "溝通表達",
    0,
    "不限獎銜",
    "rose",
  ],
  [
    "lead",
    "帶領團隊，一起走得更遠",
    "建立信任、培養人才，實踐你的領導力",
    "寰宇領導學院",
    "團隊領導",
    1280,
    "白金",
    "gold",
  ],
  [
    "life",
    "打造你的日常健康計畫",
    "在忙碌生活裡，留一點時間給自己",
    "寰宇生活學院",
    "健康生活",
    0,
    "不限獎銜",
    "blue",
  ],
  [
    "share",
    "把經驗，說成動人的故事",
    "梳理你的經歷，找到分享的力量",
    "寰宇培訓團隊",
    "溝通表達",
    680,
    "不限獎銜",
    "clay",
  ],
  [
    "growth",
    "從個人成長到團隊傳承",
    "讓好經驗持續發生，建立學習文化",
    "寰宇領導學院",
    "團隊領導",
    0,
    "翡翠",
    "violet",
  ],
] as const;
export const initialCourses: Course[] = titles.map(
  ([id, title, subtitle, teacher, category, price, rank, theme]) => ({
    id,
    title,
    subtitle,
    teacher,
    category,
    price,
    rank,
    theme,
    published: true,
    lessons: [
      { id: "welcome", title: "課前導讀：認識這堂課", minutes: 3 },
      { id: "foundation", title: "建立觀念與學習方法", minutes: 12 },
      { id: "practice", title: "情境練習與行動計畫", minutes: 18 },
      { id: "review", title: "課程回顧與下一步", minutes: 7 },
    ],
  }),
);
export function initialState(): State {
  return {
    version: 1,
    member: null,
    courses: structuredClone(initialCourses),
    cart: [],
    orders: [],
    notices: [],
    favorites: [],
    completed: {},
    notes: {},
    preferences: { reminders: true },
  };
}
export function eligible(member: Member | null, course: Course): boolean {
  return (
    !!member &&
    (course.rank === "不限獎銜" ||
      ranks.indexOf(member.rank) >= ranks.indexOf(course.rank))
  );
}
export function owned(
  state: State,
  courseId: string,
  memberId = state.member?.id,
): boolean {
  return state.orders.some(
    (o) =>
      o.memberId === memberId &&
      o.status === "opened" &&
      o.items.some((i) => i.courseId === courseId),
  );
}
export function submitOrder(state: State, id: string, now: string): State {
  const member = state.member;
  if (!member) throw Error("請先登入測試會員");
  if (!state.cart.length) throw Error("購物車沒有課程");
  const courses = state.cart.map((cid) =>
    state.courses.find((c) => c.id === cid),
  );
  if (courses.some((c) => !c || !c.published || !eligible(member, c)))
    throw Error("課程已下架或獎銜資格不符，請重新確認");
  if (
    courses.some(
      (c) =>
        owned(state, c!.id) ||
        state.orders.some(
          (o) =>
            o.memberId === member.id &&
            o.status === "pending" &&
            o.items.some((i) => i.courseId === c!.id),
        ),
    )
  )
    throw Error("已有已開通或待審核訂單，請勿重複送出");
  const items = courses.map((c) => ({
    courseId: c!.id,
    title: c!.title,
    price: c!.price,
  }));
  // Split free and paid courses so a free entitlement never waits for payment review.
  const groups = [
    items.filter((i) => i.price === 0),
    items.filter((i) => i.price > 0),
  ].filter((g) => g.length);
  const orders: Order[] = groups.map((group, index) => ({
    id: index ? `${id}-${index}` : id,
    memberId: member.id,
    items: group,
    total: group.reduce((sum, i) => sum + i.price, 0),
    status: group.every((i) => i.price === 0) ? "opened" : "pending",
    createdAt: now,
  }));
  const notices = orders.flatMap((o) => [
    {
      id: `${o.id}-student`,
      recipient: member.id,
      title: o.status === "opened" ? "課程已開通" : "訂單已送出，等待人工審核",
      body: o.items.map((i) => i.title).join("、"),
      href: `/orders/${o.id}`,
      read: false,
    },
    ...(o.status === "pending"
      ? [
          {
            id: `${o.id}-admin`,
            recipient: "admin",
            title: "有新的訂單待審核",
            body: `${member.name} · NT$${o.total}`,
            href: `/admin/orders/${o.id}`,
            read: false,
          },
        ]
      : []),
  ]);
  return {
    ...state,
    cart: [],
    orders: [...orders, ...state.orders],
    notices: [...notices, ...state.notices],
  };
}
export function reviewOrder(
  state: State,
  id: string,
  approve: boolean,
  reason: string,
): State {
  if (state.member?.role !== "admin") throw Error("需要測試管理員權限");
  const order = state.orders.find((o) => o.id === id);
  if (!order || order.status !== "pending") throw Error("訂單已處理或不存在");
  if (!approve && !reason.trim()) throw Error("請填寫未通過原因");
  return {
    ...state,
    orders: state.orders.map((o) =>
      o.id === id
        ? { ...o, status: approve ? "opened" : "rejected", reason }
        : o,
    ),
    notices: [
      {
        id: `${id}-review`,
        recipient: order.memberId,
        title: approve ? "付款確認完成，課程已開通" : "訂單審核未通過",
        body: approve ? "前往我的課程開始學習。" : reason,
        href: `/orders/${id}`,
        read: false,
      },
      ...state.notices,
    ],
  };
}
export const storageKey = "hglobal:web-v2:sandbox:v1";
export interface LearningGateway {
  getCatalog(): Promise<Course[]>;
  getPlayback(
    courseId: string,
    lessonId: string,
  ): Promise<
    { kind: "mux-signed"; url: string } | { kind: "youtube"; videoId: string }
  >;
}
// Production adapter intentionally absent: never fetch central identity or sign video URLs here.
export const sandboxGateway: LearningGateway = {
  async getCatalog() {
    return structuredClone(initialCourses);
  },
  async getPlayback() {
    throw Error("正式影片尚未接入；目前僅提供原創導讀示範。");
  },
};
