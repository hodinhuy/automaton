# Thiết kế Web Dashboard Theo Dõi Automaton & Multi-Agent Colony

Tài liệu đặc tả kiến trúc và giao diện cho bảng điều khiển (Dashboard UI) phục vụ giám sát toàn diện Agent cha (Orchestrator) và các Sub-Agents (Workers) chạy ở chế độ Self-hosted 100% kết nối qua 9Router Gateway.

---

## 1. Mục tiêu hệ thống
- **Giám sát thời gian thực (Real-time Monitoring):** Trạng thái chu kỳ sống (Waking, Running, Sleeping), nhịp tim (Heartbeat ticks).
- **Phả hệ tác tử (Multi-Agent Colony Tree):** Xem chi tiết Agent cha (`Solo`) và các Agent con (`worker-executor`, `worker-researcher`, `worker-generalist`).
- **Theo dõi suy nghĩ & hành động (Reasoning & Tool Inspection):** Log luồng tư duy ReAct (`thinking`), lệnh tool được gọi (`tool_calls`), đối số và kết quả trả về.
- **Thống kê Token & Chi phí Inference:** Tổng số token (Prompt / Completion) tiêu tốn theo từng lượt, biểu đồ thống kê theo model.
- **Sổ cái kinh tế Chủ nhà - Người thuê (Landlord & Tenant Ledger):** Số dư ảo ($100.00), hạn mức bảo vệ ngân quỹ, lịch sử nộp tiền về ví chủ nhà (`pay_rent_to_creator`).
- **Tiến độ Mục tiêu & Kế hoạch (Goals & Task Graph):** Theo dõi Goal lớn, trạng thái các phase (Phân loại ➔ Lập kế hoạch ➔ Thực thi ➔ Nghiệm thu).

---

## 2. Kiến trúc kỹ thuật đề xuất (Phương án 2)

```
┌────────────────────────────────────────────────────────┐
│             SQLite Database (state.db)                 │
│      - turns, tool_calls, goals, task_graph            │
│      - children, identity, transactions, heartbeat     │
└──────────────────────────┬─────────────────────────────┘
                           │ (read-only query / WAL mode)
┌──────────────────────────▼─────────────────────────────┐
│          Dashboard API Server (Node.js/Fastify)        │
│          - Port: 3777                                  │
│          - Server-Sent Events (SSE) stream (/api/live) │
│          - REST Endpoints (/api/stats, /api/colony)    │
└──────────────────────────┬─────────────────────────────┘
                           │ Real-time Data Push
┌──────────────────────────▼─────────────────────────────┐
│          Frontend SPA (Vite + React + Tailwind)        │
│          - packages/dashboard                          │
│          - Dark Mode / Cyber-Terminal aesthetic        │
└────────────────────────────────────────────────────────┘
```

---

## 3. Các thành phần giao diện chính (UI Components)

### 3.1. Header & Live Indicator
- **Tên Agent:** `Solo` (Address: `0x...`)
- **Trạng thái:** Badge động `[RUNNING]` (xanh lục), `[SLEEPING (42s)]` (xanh dương), `[PLANNING]` (vàng).
- **Active Model:** Model hiện tại theo cấu hình (`inferenceModel` @ Gateway).
- **Nút tương tác:** Gửi prompt/task trực tiếp cho Agent từ giao diện.

### 3.2. Metrics Overview Cards
- **Landlord Virtual Balance:** `$100.00` (10,000 cents).
- **Rent Paid to Landlord:** `$0.00` (Cập nhật khi gọi tool `pay_rent_to_creator`).
- **Total Token Consumed:** Tổng token tích lũy (Input + Output).
- **Active Workers:** Số Sub-Agents đang hoạt động song song.

### 3.3. Colony & Sub-Agents Tree (Cây phân cấp tác tử)
- Danh sách dạng Card/Tree thể hiện:
  - **Cha (Solo):** Orchestrator role.
  - **Con (Worker #1, #2):** Vai trò cụ thể, Task được giao, tiến độ thực hiện.
  - **Trạng thái từng Worker:** `idle`, `running`, `completed`, `failed`.

### 3.4. Live Reasoning Feed (Luồng tư duy ReAct)
- Hiển thị danh sách các Turns mới nhất.
- Khi bấm vào từng Turn:
  - Khung **Thinking Markdown**: Nội dung suy nghĩ nội tâm của AI.
  - Khung **Tool Execution**: Tên tool, thời gian chạy (`duration_ms`), tham số JSON và kết quả trả về.
  - Badge thống kê: Số lượng token tiêu tốn của lượt đó.

### 3.5. Task Graph & Goal Pipeline
- Hiển thị danh sách Goals:
  - Title, Description, Phase hiện tại (`classifying`, `planning`, `plan_review`, `executing`).
  - Danh sách Task con với trạng thái trực quan: `pending` ➔ `assigned` ➔ `running` ➔ `completed`.

---

## 4. Lộ trình triển khai
1. **Giai đoạn 1 (Backend API):** Dựng API server đọc SQLite `state.db`, mở endpoint SSE stream phát sự kiện khi có Turn hoặc Task mới.
2. **Giai đoạn 2 (Frontend SPA):** Khởi tạo `packages/dashboard` với React, Tailwind CSS và Recharts.
3. **Giai đoạn 3 (Tích hợp CLI):** Thêm lệnh `automaton --dashboard` hoặc `pnpm dashboard` để khởi chạy đồng thời cả Agent và Web UI.
