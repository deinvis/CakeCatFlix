interface PageHeaderProps {
  title: string;
  description?: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="mb-6 md:mb-8">
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground tracking-tight">
        {title}
      </h1>
      {description && (
        <p className="mt-1 text-base text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
