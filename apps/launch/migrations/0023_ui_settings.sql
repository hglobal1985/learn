-- 超級管理員可調整的畫面設定（課程排序優先順位、緞帶文字與顏色、統計分析可看的職務），整份存成一筆 JSON。
CREATE TABLE ui_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
