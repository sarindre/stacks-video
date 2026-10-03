import { formatLabel } from './catalog'
import type { Item } from './types'

export interface StoreLink {
  name: string
  url: string
}

const q = encodeURIComponent

/**
 * Search links for finding a copy (wishlist) or checking what one sells for. They are plain
 * links that open in a new tab; nothing is sent anywhere until you click one.
 */
export function storeLinks(item: Pick<Item, 'category' | 'format' | 'title' | 'year' | 'creator'>): StoreLink[] {
  const format = formatLabel(item.category, item.format)
  const withFormat = q(`${item.title} ${format}`.trim())
  const withCreator = q(`${item.title} ${item.creator ?? ''}`.trim())
  const title = q(item.title)

  const amazon = (term: string): StoreLink => ({ name: 'Amazon', url: `https://www.amazon.com/s?k=${term}` })
  const ebay = (term: string): StoreLink => ({ name: 'eBay', url: `https://www.ebay.com/sch/i.php?_nkw=${term}` })

  switch (item.category) {
    case 'movie':
    case 'tv':
      return [
        amazon(withFormat),
        ebay(withFormat),
        { name: 'Blu-ray.com', url: `https://www.blu-ray.com/search/?quicksearch=1&quicksearch_keyword=${title}&section=bluraymovies` },
        { name: 'Google Shopping', url: `https://www.google.com/search?tbm=shop&q=${withFormat}` },
      ]
    case 'game':
      return [amazon(withFormat), ebay(withFormat), { name: 'PriceCharting', url: `https://www.pricecharting.com/search-products?type=prices&q=${withFormat}` }]
    case 'music':
      return [{ name: 'Discogs', url: `https://www.discogs.com/search/?q=${withCreator}&type=release` }, amazon(withFormat), ebay(withFormat)]
    case 'book':
      return [{ name: 'AbeBooks', url: `https://www.abebooks.com/servlet/SearchResults?kn=${withCreator}` }, { name: 'Bookshop.org', url: `https://bookshop.org/search?keywords=${withCreator}` }, amazon(withCreator), ebay(withCreator)]
  }
}
