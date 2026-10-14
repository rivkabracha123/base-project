/** Catch explicit unrelated requests even when earlier turns contain auction terms. */
export function isExplicitlyOffTopic(prompt: string): boolean {
  const text = prompt.toLowerCase();
  const auctionRequest = /מכירה פומבית|מכירות פומביות|למכור|לקנות|מחפש|מחפשת|auction|\b(?:buy|sell|collect|valuation)\b/.test(text);
  if (auctionRequest) return false;
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
  return /auction|מכירות|מכירה|בית מכירות|בתי מכירות/i.test(input)
    && /הכי (?:יקר|גבוה)|הגבוה ביותר|most expensive|highest (?:price|amount)|auction record|שיא.*(?:מכירה|מחיר)|מה זה|מהי|what is|how do auctions|מפורסם.*(?:מכר|מכירה)|(?:celebrity|famous).*(?:sold|auction)/i.test(input);
}
