import { TicCardsList } from "@/components/tic-cards/tic-cards-list";

export default function TicCardsPage() {
  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">チックカード管理</h1>
      <TicCardsList />
    </div>
  );
}
