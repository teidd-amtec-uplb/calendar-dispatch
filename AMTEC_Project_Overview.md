# AMTEC Calendar Dispatch System
**Project Overview & User Manual Outline**

This document provides a comprehensive overview of the AMTEC Calendar Dispatch web application. It is structured to serve as an outline for your PowerPoint presentation and as a foundational guide for the user manual.

---

## 1. Project Introduction
**What is the AMTEC Calendar Dispatch System?**
The AMTEC Calendar Dispatch System is a modern, centralized web application designed specifically for the Agricultural Machinery Testing and Evaluation Center (AMTEC). It digitalizes and streamlines the process of scheduling field tests, managing personnel workloads, allocating machines/instruments, and automatically generating official travel and dispatch documentation.

**Key Objectives:**
- Replace fragmented, manual Excel-based tracking with a unified, real-time database.
- Prevent scheduling conflicts for personnel, machines, and test instruments.
- Drastically reduce administrative overhead by automating the generation and emailing of official documentation.
- Provide a clear, visual snapshot of daily laboratory and field workloads.

---

## 2. Core Features (The "Wow" Factor for Presentations)
- **Interactive Workload Calendar:** An Excel-like, interactive visual calendar that displays the real-time availability of all engineers and technicians. It supports click-and-drag bulk assignments and instantly highlights scheduling overlaps.
- **Smart Availability Engine:** The system actively tracks leaves, sick days, and ongoing dispatches. It automatically prevents schedulers from assigning personnel or instruments that are already deployed.
- **1-to-1 Document Generation:** With a single click, the system generates perfect, print-ready MS Word (`.docx`) carbon copies of the official AMTEC templates:
  - *Dispatch Form*
  - *Travel Request Form*
  - *SAL Sample Acceptance Form*
- **Automated Email Distribution:** Upon generating documents, the system automatically emails the attached files to all assigned test engineers, ensuring instant communication.
- **Role-Based Access Control (RBAC):** Secure, tailored interfaces for Schedulers, AMaTS, the Mechanical Lab, and general Viewers.

---

## 3. Technology Stack (For the Technical Slides)
- **Frontend / UI:** Built on **Next.js** and **React**, styled with **Tailwind CSS** for a highly responsive, modern, and fast user interface.
- **Backend / Database:** Powered by **Supabase** (PostgreSQL), providing secure authentication, real-time database syncing, and role-based row-level security.
- **Document Engine:** Custom-built generation logic using **docx (v8)**, executing strict grid-layouts, image embedding (AMTEC logo), and exact typography to match physical hard-copies.
- **Mailing System:** Integrated with **Resend** for reliable, automated transactional emails.

---

## 4. User Manual: Step-by-Step Workflows

### A. Logging In & The Dashboard
1. Navigate to the AMTEC Dispatch web portal.
2. Enter your authorized credentials.
3. The Dashboard provides a high-level overview of total personnel, machines, and the current month's active dispatches.

### B. Viewing the Workload Calendar
1. Click on **Workload** in the sidebar.
2. Select the desired Month and Year.
3. The grid displays days (1-31) horizontally and personnel vertically. 
4. **Color Codes:** Look for colored bars indicating ongoing dispatches, leaves, or laboratory duties.
5. **Quick Edit:** Schedulers can click-and-drag across dates to instantly assign new workload events (like Lab duties or Sick Leaves).

### C. Creating a New Dispatch
1. Click **+ New Dispatch** from the sidebar or the Dispatches page.
2. **General Details:** Enter the company name, location, and travel dates.
3. **Personnel Assignment:** Select the Lead Engineer, Assistant Engineers, and Technicians. *(Note: The system will disable names of staff who are unavailable during the selected dates).*
4. **Instruments & Machines:** Search and add required test instruments and machines (e.g., Tractors, Disc Harrows).
5. Click **Submit**. The system will save the dispatch and update the Workload Calendar in real-time.

### D. Generating & Emailing Documents
1. Navigate to the **Dispatches** list and click on an ongoing/completed dispatch to view its details.
2. Click the blue **Generate Documents** button at the top right.
3. A modal will appear explaining the three official documents to be generated.
4. Click **Generate All Documents**.
5. The system will compile the `.docx` files, automatically email them to the assigned engineers, and provide you with instant Download buttons to save them locally.

### E. Managing & Deleting Dispatches
1. From the **Dispatches** page, schedulers can filter records by Month, Status, or Personnel.
2. To edit a dispatch, click its row to open the Details page, then click the **Edit Dispatch** pencil icon.
3. To delete a dispatch (Admin/Schedulers only), click the red **Trash** icon on the far right of the table row. Confirm the prompt to permanently remove the record.

---

## 5. Conclusion & Future Outlook
The AMTEC Calendar Dispatch System represents a massive leap forward in operational efficiency. By centralizing data and automating the most tedious paperwork, the AMTEC team can focus less on administrative tracking and more on executing critical agricultural machinery evaluations.
