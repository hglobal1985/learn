/** 偵測 YouTube 影片長度（秒）。只有網頁版可以（用看不見的播放器讀取）；手機 App 回傳 null。 */
export async function detectYoutubeSeconds(_videoId: string): Promise<number | null> {
  return null;
}
