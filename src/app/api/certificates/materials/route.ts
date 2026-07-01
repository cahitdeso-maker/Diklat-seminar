import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seminars, speakers } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

// GET: Generate halaman lampiran daftar materi
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const seminarId = searchParams.get("seminarId");
    const search = searchParams.get("search")?.trim() || "";

    if (!seminarId) {
      return NextResponse.json(
        { error: "seminarId harus diisi" },
        { status: 400 },
      );
    }

    // Ambil data seminar
    const [seminar] = await db
      .select()
      .from(seminars)
      .where(eq(seminars.id, seminarId))
      .limit(1);

    if (!seminar) {
      return NextResponse.json(
        { error: "Seminar tidak ditemukan" },
        { status: 404 },
      );
    }

    // Ambil materi dari tabel speakers (topic)
    const speakerMaterials = await db
      .select({
        topic: speakers.topic,
      })
      .from(speakers)
      .where(and(eq(speakers.seminarId, seminarId), eq(speakers.isDeleted, false)))
      .orderBy(speakers.displayOrder);

    // Filter hanya yang memiliki topic
    let materialsList = speakerMaterials
      .filter((sm) => sm.topic && sm.topic.trim())
      .map((sm) => ({ topic: sm.topic!.trim() }));

    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase();
      materialsList = materialsList.filter((m) =>
        m.topic.toLowerCase().includes(searchLower)
      );
    }

    if (materialsList.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada materi untuk seminar ini" },
        { status: 404 },
      );
    }

    // Format tanggal
    const seminarDate = new Date(seminar.date);
    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    const tanggalStr = seminarDate.toLocaleDateString("id-ID", options);

    // Build HTML
    const html = generateMaterialsHtml(
      seminar.title,
      tanggalStr,
      materialsList,
    );

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Generate materials error:", error);
    return NextResponse.json(
      { error: "Gagal generate lampiran materi" },
      { status: 500 },
    );
  }
}

interface MaterialItem {
  topic: string;
}

function generateMaterialsHtml(
  title: string,
  date: string,
  materials: MaterialItem[],
): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <style>
    @media print {
      html {
        background: white;
        padding: 0;
      }
      body {
        border: none;
        box-shadow: none;
      }
    }
    @page {
      size: landscape;
      margin: 0;
      padding: 0;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      width: 1123px;
      height: 794px;
      margin: auto;
      font-family: Arial, Helvetica, sans-serif;
      position: relative;
      overflow: hidden;
      background: #d9d9d9;
      display: flex;
      flex-direction: column;
      border: 1px solid #bbb;
      box-shadow: 0 0 15px rgba(0,0,0,.25);
    }
    .header-wrap {
      width: 100%;
    }
    .header-img {
      width: 100%;
      display: block;
    }
    .content {
      width: 100%;
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 5px 80px 30px;
      position: relative;
      z-index: 2;
    }
    .title {
      font-size: 28px;
      font-weight: bold;
      color: #033b5c;
      text-align: center;
      transform: translateY(-100px);
      margin-bottom: 10px;
      text-transform: uppercase;
    }
    .materials-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 15px;
    }
    .materials-table th {
      background-color: #033b5c;
      color: #ffffff;
      padding: 10px 14px;
      text-align: center;
      font-weight: bold;
      border: 1px solid #000;
      font-size: 16px;
    }
    .materials-table td {
      padding: 8px 14px;
      text-align: center;
      border: 1px solid #000;
      color: #000000;
    }
    .materials-table tr:nth-child(even) {
      background-color: #f2f8fc;
    }
    .materials-table tr:nth-child(odd) {
      background-color: #ffffff;
    }
    .materials-table .no-col {
      text-align: center;
      width: 50px;
    }
    .footer-img {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      z-index: 1;
      display: block;
    }
  </style>
</head>
<body>
  <div class="header-wrap">
    <img class="header-img" src="/img/atas_materi.jpg" alt="Header Materi" />
  </div>
  <div class="content">
    <div class="title">DAFTAR MATERI</div>
    <table class="materials-table">
      <thead>
        <tr>
          <th class="no-col">No</th>
          <th>Materi</th>
        </tr>
      </thead>
      <tbody>
        ${materials
          .map(
            (m, i) => `
        <tr>
          <td class="no-col">${i + 1}</td>
          <td>${m.topic}</td>
        </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  </div>
  <img class="footer-img" src="/img/bawah.jpg" alt="Footer Background" />
</body>
</html>`;
}
