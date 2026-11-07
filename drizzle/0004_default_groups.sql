-- Default groups. A migration runs once, so a group deleted later does not come back on the next deploy.
INSERT INTO "groups" ("name") VALUES
	('Семья'),
	('Друзья'),
	('Знакомые'),
	('Теннис'),
	('Аналитики');
