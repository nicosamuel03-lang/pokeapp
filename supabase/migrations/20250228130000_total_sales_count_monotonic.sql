-- Compteur free tier : users.total_sales_count ne doit JAMAIS diminuer quand une ligne
-- est supprimée de public.sales (sinon contournement de la limite 10 unités).
--
-- Si vous aviez ajouté un trigger qui décrémente total_sales_count au DELETE sur sales,
-- supprimez-le ici (adaptez le nom) :
--
-- DROP TRIGGER IF EXISTS <nom_du_trigger> ON public.sales;
-- DROP FUNCTION IF EXISTS <nom_de_la_fonction>();

-- Aucune modification automatique requise si aucun trigger de décrément n’existe.

select 1;
