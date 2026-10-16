# Kiến Trúc Nhân Viên Số Đa Kênh (Omnichannel Digital Human Architecture)

Tài liệu này định hình chiến lược kiến trúc, phân loại kênh giao tiếp và lộ trình triển khai để biến Automaton thành một **Nhân viên AI số toàn diện** hiện diện trên mọi nền tảng (Telegram, Zalo, Discord, Facebook, Threads, Instagram, Reddit, TikTok).

---

## I. Bức Tranh Tổng Thể (The Grand Vision)

```
                              ┌─────────────────────────────────────────┐
                              │            BỘ NÃO TRUNG TÂM             │
                              │   • ReAct Loop & Attention Tracker      │
                              │   • Trí nhớ 5 tầng (SQLite FTS5)        │
                              │   • Nhịp tim tự hành (Durable Scheduler)│
                              │   • Ví thu ngân (Cashier Wallet: USDC)  │
                              └────────────────────┬────────────────────┘
                                                   │
                         ┌─────────────────────────┴─────────────────────────┐
                         ▼                                                   ▼
            ┌─────────────────────────┐                         ┌─────────────────────────┐
            │   NHÓM 1: REALTIME CHAT │                         │   NHÓM 2: CONTENT & MXH │
            │  (Phản hồi tức thì)     │                         │  (Tương tác theo lịch)  │
            ├─────────────────────────┤                         ├─────────────────────────┤
            │ • Telegram (GramJS)     │                         │ • Facebook (Fanpage/Grp)│
            │ • Zalo (zca-js)         │                         │ • Threads / Instagram   │
            │ • Discord (discord.js)  │                         │ • X (Twitter) / Reddit  │
            │                         │                         │ • TikTok (Video/Comment)│
            └─────────────────────────┘                         └─────────────────────────┘
```

---

## II. Phân Loại 2 Nhóm Kênh Hoạt Động

Để không bị quá tải công sức lập trình và tránh rủi ro bị khóa tài khoản, các kênh được chia thành 2 nhóm chuyên biệt:

### Nhóm 1: Realtime Chat (Hội thoại 1-1 / Nhóm)
* **Các kênh:** Telegram, Zalo, Discord.
* **Đặc điểm:**
  - Cần duy trì kết nối liên tục (Socket / Polling).
  - Phản hồi nhanh trong vòng vài giây khi có tin nhắn mới hoặc được nhắc tên (`@tag`).
  - Giao tiếp trực tiếp với người quản lý (Creator) và khách hàng.
* **Giải pháp kỹ thuật:**
  - Sử dụng thư viện Protocol/API chuyên dụng:
    - **Telegram:** `telegram` (GramJS MTProto) — dùng tài khoản người dùng thật hoặc Bot.
    - **Zalo:** `zca-js` — Unofficial Zalo API qua cơ chế quét mã QR / Cookie.
    - **Discord:** `discord.js` — WebSocket gateway client.

### Nhóm 2: Content & Social Media (Đăng bài, Lướt Feed, Comment)
* **Các kênh:** Facebook, Threads, Instagram, Reddit, TikTok, X (Twitter).
* **Đặc điểm:**
  - Không cần online 24/7 từng giây. Hoạt động theo **lịch trình (Cron / Heartbeat Schedule)**.
  - Tác vụ: Đăng bài buổi sáng, đi tương tác comment buổi trưa, quét bài viết theo dõi trend buổi tối.
* **Giải pháp kỹ thuật (Browser Agent):**
  - **KHÔNG code API riêng lẻ cho từng mạng xã hội** (vì Meta/TikTok liên tục đổi thuật toán, chống reverse API cực gắt).
  - **Sử dụng 1 Trình duyệt ẩn danh (Headless/Headed Browser Agent - Playwright / CDP)**:
    - Trình duyệt lưu sẵn User Data Profile (Cookie đăng nhập của FB, Threads, TikTok...).
    - Nhân viên AI điều khiển trình duyệt như người thật: di chuột ngẫu nhiên, gõ phím theo nhịp độ tự nhiên (`human typing emulation`), tự click đăng bài và comment.
    - **Ưu điểm:** Một công cụ cân hết 5 nền tảng, tỷ lệ sống tài khoản cao nhất, tiết kiệm thời gian code gấp 10 lần.

---

## III. Thiết Kế Kiến Trúc Social Connector Hub

Cấu trúc thư mục định hướng trong codebase:

```text
src/social/
├── hub.ts                 # Hub điều phối tin nhắn vào/ra tập trung
├── types.ts               # Định nghĩa interface chuẩn
├── channels/              # Các adapter chuyên biệt
│   ├── telegram.ts        # Adapter Telegram (GramJS)
│   ├── zalo.ts            # Adapter Zalo (zca-js)
│   └── discord.ts         # Adapter Discord
└── browser/               # Trình duyệt tự động cho MXH (FB, Threads, TikTok...)
    ├── browser-agent.ts   # Điều khiển Playwright / Chromium Profile
    └── actions/           # Kịch bản tương tác (đăng bài, cmt, lướt feed)
```

### Hợp đồng giao tiếp chuẩn (Standard Contract):

```typescript
export interface IncomingMessage {
  id: string;
  channel: 'telegram' | 'zalo' | 'discord' | 'facebook' | 'web';
  senderId: string;
  senderName: string;
  isCreator: boolean;
  content: string;
  threadType: 'direct' | 'group';
  timestamp: string;
  reply: (text: string) => Promise<void>;
}

export interface SocialChannelConnector {
  readonly channelName: string;
  init(): Promise<void>;
  sendMessage(targetId: string, content: string): Promise<void>;
  onMessage(handler: (msg: IncomingMessage) => Promise<void>): void;
}
```

---

## IV. Lộ Trình Triển Khai Thực Tế (Phased Roadmap)

### Giai đoạn 1: Nền Tảng Hub & Kênh Giao Tiếp Đầu Tiên (1-2 Tuần)
1. Xây dựng `SocialConnectorHub` chuẩn hóa luồng tin nhắn vào SQLite `inbox_messages`.
2. Kích hoạt kênh giao tiếp đầu tiên: **Telegram Userbot** (hoặc **Zalo cá nhân qua `zca-js`**).
3. Đấu nối vào Nhịp tim (`Heartbeat`): Có tin nhắn mới hoặc có tiền tip USDC $\rightarrow$ Tự thức dậy trả lời / báo cáo.
* **Kết quả:** Người chủ có thể giao việc cho nhân viên AI trực tiếp qua điện thoại.

### Giai đoạn 2: Kích Hoạt Kênh Zalo & Trình Duyệt Tự Động (2-3 Tuần)
1. Tích hợp kênh Zalo cá nhân (`zca-js`) với cơ chế đăng nhập bằng mã QR.
2. Tích hợp module **Browser Agent (Playwright)** với hồ sơ trình duyệt người dùng thật.
3. Huấn luyện bot kỹ năng: Tự vào X/Twitter hoặc Reddit đọc tin tức và tổng hợp xu hướng mỗi ngày.

### Giai đoạn 3: Mở Rộng Ra Mạng Xã Hội Lớn (Meta & TikTok)
1. Viết kịch bản tự động hóa cho Browser Agent:
   - Đăng bài lên Facebook Fanpage / Group.
   - Đăng Threads và Instagram Carousel.
2. Gắn công cụ sinh video / hình ảnh tự động.
3. Cơ chế an toàn (Anti-Ban Policy): Giới hạn tần suất thao tác, giả lập hành vi gõ phím của con người.

---

## V. Nguyên Tắc An Toàn Sống Còn (Anti-Ban Rules)

1. **Tuổi thọ tài khoản:** Luôn dùng tài khoản đã đăng ký từ trước (ít nhất 2–4 tuần tuổi), không dùng nick vừa tạo để tự động hóa hàng loạt.
2. **Độ trễ hành vi người (Human-like Delays):** Trước khi gửi tin nhắn hoặc đăng bài, luôn có khoảng nghỉ ngẫu nhiên (2 – 5 giây), mô phỏng trạng thái `typing...`.
3. **Giới hạn số lượng (Hard Limits):** Kiểm soát qua `PolicyEngine`: không gửi quá 15 tin nhắn cho người lạ mỗi giờ, không đăng quá 3 bài MXH mỗi ngày trên cùng một nền tảng.
4. **Cô lập phiên Zalo:** Do Zalo chỉ cho phép 1 session Web/PC hoạt động, tài khoản Zalo của nhân viên AI phải dùng SIM riêng biệt.
