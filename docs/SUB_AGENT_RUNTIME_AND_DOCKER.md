# Kiến Trúc Thực Thi Sub-Agent & Đề Xuất Self-Hosted Docker Sandbox

Tài liệu phân tích môi trường thực thi hiện tại của Sub-Agent trong Automaton, so sánh ưu nhược điểm giữa chạy trực tiếp trên máy chủ và chạy trong Docker Container, cùng lộ trình triển khai Docker Sandbox tự host 100%.

---

## 1. Sub-Agent hiện tại đang chạy ở đâu?

Với kiến trúc **`LocalWorkerPool`**, Sub-Agent hoạt động theo mô hình **In-Process Asynchronous Worker**:

- **Môi trường tiến trình:** Sub-Agent là một luồng logic bất đồng bộ (Promise/Task) chạy ngầm ngay trong tiến trình Node.js của Agent cha.
- **Không gian lưu trữ riêng (Workspace):**
  - Đường dẫn: `~/.automaton/workspace/<goal_id>/`
  - Chứa subplans, context decisions, các file artifact do Sub-Agent tạo ra.
- **Luồng Inference:**
  - Mỗi Sub-Agent có ReAct loop riêng theo role (`coding`, `research`, `generalist`, `tester`).
  - Gửi request độc lập qua cầu nối `UnifiedInference` tới **Inference Gateway** (`process.env.OPENAI_BASE_URL` hoặc cấu hình khi setup) với model được chỉ định.
- **Thực thi lệnh (`exec`):**
  - Chạy trực tiếp qua `child_process.execSync` trên hệ điều hành máy chủ (Windows cmd.exe / PowerShell).

---

## 2. So sánh: Chạy trực tiếp trên Host vs Chạy trong Docker Container

| Tiêu chí | Chạy trực tiếp trên Host (Hiện tại) | Chạy trong Docker Sandbox (Tự host) |
| :--- | :--- | :--- |
| **Tài nguyên & Tốc độ** | ⚡ Siêu nhẹ, khởi động tức thì (0s), không tốn RAM cho ảo hóa. | ⏳ Khởi động mất 1-3s để spin up container, tốn thêm 1-2GB RAM cho Docker engine. |
| **Tương thích lệnh (CLI Compatibility)** | ⚠️ **Hạn chế trên Windows**: AI LLM thường mặc định sinh lệnh Linux (`apt-get`, `grep`, `bash`, `curl \| sh`), dễ bị lỗi cú pháp trên Windows. | 🟢 **Hoàn hảo 100%**: Container chạy Ubuntu/Debian Linux chuẩn, tương thích với mọi lệnh shell mà LLM sinh ra. |
| **Mức độ an toàn & Cô lập (Security Isolation)** | ⚠️ **Có rủi ro**: Dù có lớp `PolicyEngine` kiểm soát quyền, nếu AI hallucinate gõ lệnh can thiệp hệ thống máy chủ vẫn tiềm ẩn nguy cơ. | 🛡️ **An toàn tuyệt đối**: Mọi lệnh chạy trong Sandbox cô lập hoàn toàn. Agent có thử gõ `rm -rf /` hay làm hỏng file cũng chỉ ảnh hưởng bên trong container. |
| **Khả năng dọn dẹp (Cleanup)** | Phải quản lý dọn dẹp các thư mục rác và tiến trình con thủ công. | Dọn dẹp sạch sẽ chỉ bằng 1 lệnh `docker rm -f`. |

---

## 3. Đề xuất kiến trúc Self-Hosted Docker Sandbox (Thay thế Conway Cloud)

Thay vì gọi lên cloud `api.conway.tech` để thuê máy ảo, Automaton có thể tự quản lý Docker Engine nội bộ:

```
┌────────────────────────────────────────────────────────┐
│             Agent Cha (Solo / Orchestrator)            │
│               Chạy trên Node.js máy chủ               │
└──────────────────────────┬─────────────────────────────┘
                           │ Quản lý & giao việc
        ┌──────────────────┴──────────────────┐
        ▼                                     ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│  Docker Container (Worker 1) │  │  Docker Container (Worker 2) │
│  - Image: node:22-bookworm   │  │  - Image: node:22-bookworm   │
│  - Môi trường: Linux xịn     │  │  - Môi trường: Linux xịn     │
│  - Cài sẵn: git, curl, npm   │  │  - Cài sẵn: git, curl, npm   │
│  - Mount: workspace thư mục  │  │  - Mount: workspace thư mục  │
└──────────────────────────────┘  └──────────────────────────────┘
```

### Cơ chế hoạt động của `LocalDockerDriver`:
1. **Khởi tạo (Spawn):**
   - Agent cha gọi: `docker run -d --name automaton-child-<id> -v <workspace>:/workspace -w /workspace node:22-bookworm-slim sleep infinity`
2. **Thực thi lệnh (`exec`):**
   - Khi Agent con chạy lệnh `exec`: `docker exec automaton-child-<id> sh -c "<command>"`
   - Toàn bộ lệnh Linux (`apt-get`, `git clone`, `npm test`) chạy chuẩn xác trong container.
3. **Thu hồi & Dọn dẹp (Teardown):**
   - Khi Task hoàn thành hoặc Agent chết: `docker rm -f automaton-child-<id>`

---

## 4. Lộ trình triển khai tối ưu

1. **Giai đoạn 1 (Hiện tại):** 
   - Dùng `LocalWorkerPool` để hoàn thiện vòng đời giao tiếp Cha - Con và đo kiểm luồng gọi 9Router.
   - Xây dựng Web Dashboard theo đặc tả tại `docs/DASHBOARD_SPEC.md`.

2. **Giai đoạn 2 (Docker Sandbox Engine):**
   - Viết module `src/conway/docker-driver.ts` thay thế trực tiếp các hàm `createSandbox`, `exec` và `deleteSandbox`.
   - Bổ sung cấu hình `useDockerSandbox: true` trong `automaton.json`.
