import ListingExplorer from '../components/ListingExplorer';
import type { ListingCategory, ListingPurpose } from '../types';

interface Props {
  title: string;
  subtitle: string;
  category?: ListingCategory;
  purpose?: ListingPurpose;
}

export default function MarketplacePage({ title, subtitle, category, purpose }: Props) {
  return (
    <ListingExplorer
      title={title}
      subtitle={subtitle}
      lockedCategory={category}
      lockedPurpose={purpose}
    />
  );
}
