/** True when the message plainly talks about buying, selling or auctions. */
export function mentionsAuctionIntent(prompt: string): boolean {
  return /מכירה פומבית|מכירות פומביות|\u05d1\u05d9\u05ea\s+\u05de\u05db\u05d9\u05e8\u05d5\u05ea|\u05d1\u05ea\u05d9\s+\u05de\u05db\u05d9\u05e8\u05d5\u05ea|למכור|לקנות|מחפש|מחפשת|auction|\b(?:buy|sell|collect|valuation)\b/.test(prompt.toLowerCase());
}

/** Catch explicit unrelated requests even when earlier turns contain auction terms. */
export function isExplicitlyOffTopic(prompt: string): boolean {
  const text = prompt.toLowerCase();
  if (mentionsAuctionIntent(text)) return false;
  return /מתכון|לעוגת|לבשל|מזג (?:ה)?אוויר|בדיחה|\b(?:recipe|cook|bake|weather|joke)\b/.test(text);
}

export function offTopicCopy(language: 'he' | 'en') {
  return language === 'he'
    ? { summary: 'אני יכולה לעזור בקנייה או במכירה של פריטים במכירות פומביות.',
      recommendation: 'הבקשה הזו אינה קשורה לתהליך הקנייה או המכירה.',
      nextAction: 'אפשר להמשיך מהפרטים שכבר מסרת, או לתאר פריט אחר שברצונך לקנות או למכור.' }
    : { summary: 'I can help with buying or selling items at auction.',
      recommendation: 'This request is outside the buying or selling process.',
      nextAction: 'We can continue with the details you already provided, or discuss another item you want to buy or sell.' };
}
export function isGeneralAuctionQuestion(input: string): boolean {
  const asksAboutAuction = /auction|מכירות|מכירה|בית מכירות|בתי מכירות/i.test(input)
    && /הכי (?:יקר|גבוה)|הגבוה ביותר|most expensive|highest (?:price|amount)|auction record|שיא.*(?:מכירה|מחיר)|מה זה|מהי|מה עושה|איך (?:עובד|עובדת|פועלת|מתנהלת)|מה כדאי לדעת|what is|what does|how (?:do|does)|why|מפורסם.*(?:מכר|מכירה)|(?:celebrity|famous).*(?:sold|auction)/i.test(input);
  const asksAboutAllTimeSaleRecord = /(?:איזה|מה)\s+(?:ה)?(?:פריט|מוצר|לוט)(?:\s|$).*(?:הכי\s+יקר|במחיר\s+הגבוה|נמכר.*(?:אי\s+פעם|בהיסטוריה|בעולם))|(?:הכי\s+יקר|המחיר\s+הגבוה\s+ביותר).*(?:נמכר|נמכרו|נמכרה)|(?:most expensive|highest[- ]priced).*(?:item|lot|object).*(?:ever\s+)?sold|(?:item|lot|object).*(?:most expensive|highest[- ]priced).*(?:ever\s+)?sold/i.test(input);
  return asksAboutAuction || asksAboutAllTimeSaleRecord;
}
