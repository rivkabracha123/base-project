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
