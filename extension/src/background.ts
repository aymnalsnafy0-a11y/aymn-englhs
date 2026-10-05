/** عامل الخلفية: قائمة «أضف إلى خطة سنافي AE» عند تحديد كلمة. */
import { saveWord, updateBadge } from './storage'

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'siyaq-save', title: 'أضف «%s» إلى خطة سنافي AE', contexts: ['selection'] })
  void updateBadge()
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'siyaq-save' && info.selectionText) void saveWord(info.selectionText, tab?.url)
})

chrome.storage.onChanged.addListener((changes) => {
  if (changes.saved) void updateBadge()
})
