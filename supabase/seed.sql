
insert into buildings (name) values ('Ramos'), ('Empress') on conflict (name) do nothing;

insert into rooms (building_id, number, floor, wing)
select b.id, r.number, r.floor, r.wing
from buildings b
cross join (values
  ('2',1,null), ('3',1,null), ('4',1,null), ('5',1,null), ('6',1,null),
  ('7',2,null), ('8',2,null), ('9',2,null), ('10',2,null), ('11',2,null), ('12',2,null),
  ('13',3,null), ('14',3,null), ('15',3,null), ('16',3,null), ('17',3,null), ('18',3,null),
  ('19',4,'gate'), ('20',4,'gate')
) as r(number, floor, wing)
where b.name = 'Ramos'
on conflict (building_id, number) do nothing;

insert into rooms (building_id, number, floor, side)
select b.id, r.number, r.floor, r.side
from buildings b
cross join (values
  ('101 A',1,'A'), ('102 A',1,'A'), ('103 A',1,'A'), ('104 A',1,'A'),
  ('101 B',1,'B'), ('102 B',1,'B'), ('103 B',1,'B'), ('104 B',1,'B'),
  ('201 A',2,'A'), ('202 A',2,'A'), ('203 A',2,'A'), ('204 A',2,'A'),
  ('201 B',2,'B'), ('202 B',2,'B'), ('203 B',2,'B'), ('204 B',2,'B'),
  ('301 A',3,'A'), ('302 A',3,'A'), ('303 A',3,'A'), ('304 A',3,'A'),
  ('301 B',3,'B'), ('302 B',3,'B'), ('303 B',3,'B'), ('304 B',3,'B'),
  ('401 A',4,'A'), ('402 A',4,'A'), ('403 A',4,'A'), ('404 A',4,'A'),
  ('401 B',4,'B'), ('402 B',4,'B'), ('403 B',4,'B'), ('404 B',4,'B'),
  ('501 A',5,'A'), ('502 A',5,'A'), ('503 A',5,'A'), ('504 A',5,'A'),
  ('501 B',5,'B'), ('502 B',5,'B'), ('503 B',5,'B'), ('504 B',5,'B')
) as r(number, floor, side)
where b.name = 'Empress'
on conflict (building_id, number) do nothing;

insert into bills (room_id, month, rate, prev_reading, pres_reading, consumption, subtotal, surcharge, total)
select r.id, v.month, v.rate, v.prev, v.pres, v.consumption, v.subtotal, v.surcharge, v.total
from buildings b
join rooms r on r.building_id = b.id
join (values

  ('Ramos','2','2026-06',86.5,100.0,106.5,6.5,563,50,613),
  ('Ramos','3','2026-06',86.5,200.0,203.4,3.4,295,50,345),
  ('Ramos','4','2026-06',86.5,150.0,155.0,5.0,433,50,483),
  ('Ramos','5','2026-06',86.5, 60.0, 61.3,1.3,113,50,163),

  ('Ramos','2','2026-07',86.5,106.5,null,0.0,0,50,50),

  ('Empress','101 A','2026-06',45.5,500.0,504.2,4.2,192,50,242),
  ('Empress','101 B','2026-06',45.5,700.0,702.1,2.1,96,50,146),
  ('Empress','102 A','2026-06',45.5,300.0,302.0,2.0,91,50,141),
  ('Empress','201 A','2026-06',45.5,900.0,904.6,4.6,210,50,260),

  ('Empress','101 A','2026-07',45.5,504.2,null,0.0,0,50,50)
) as v(building, number, month, rate, prev, pres, consumption, subtotal, surcharge, total)
  on v.building = b.name and v.number = r.number
on conflict (room_id, month) do nothing;
