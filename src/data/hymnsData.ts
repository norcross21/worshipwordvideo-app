export interface Hymn {
  id: string;
  number: string;
  title: string;
  tune: string;
  lyrics: string;
}

export interface MusicalSetting {
  id: string;
  title: string;
  composer: string;
  parts: Record<string, string>; // Gloria, Sanctus, Agnus Dei descriptions
}

export const HYMNS_ANCIENT_MODERN: Hymn[] = [
  {
    id: 'am-27',
    number: '27',
    title: 'Abide with me; fast falls the eventide',
    tune: 'Eventide',
    lyrics: `Abide with me; fast falls the eventide;
The darkness deepens; Lord, with me abide;
When other helpers fail and comforts flee,
Help of the helpless, O abide with me.

Swift to its close ebbs out life's little day;
Earth's joys grow dim, its glories pass away;
Change and decay in all around I see;
O Thou who changest not, abide with me.

I need Thy presence every passing hour;
What but Thy grace can foil the tempter's power?
Who, like Thyself, my guide and stay can be?
Through cloud and sunshine, Lord, abide with me.

I fear no foe, with Thee at hand to bless;
Ills have no weight, and tears no bitterness;
Where is death's sting? Where, grave, thy victory?
I triumph still, if Thou abide with me.

Hold Thou Thy cross before my closing eyes;
Shine through the gloom and point me to the skies;
Heaven's morning breaks, and earth's vain shadows flee;
In life, in death, O Lord, abide with me.`,
  },
  {
    id: 'am-228',
    number: '228',
    title: 'Dear Lord and Father of mankind',
    tune: 'Repton',
    lyrics: `Dear Lord and Father of mankind,
Forgive our foolish ways;
Reclothe us in our rightful mind,
In purer lives Thy service find,
In deeper reverence, praise.

In simple trust like theirs who heard
Beside the Syrian sea
The gracious calling of the Lord,
Let us, like them, without a word,
Rise up and follow Thee.

O Sabbath rest by Galilee,
O calm of hills above,
Where Jesus knelt to share with Thee
The silence of eternity,
Interpreted by love!

With dews of noiseless quietness,
Till all our strivings cease;
Take from our souls the strain and stress,
And let our ordered lives confess
The beauty of Thy peace.

Breathe through the heats of our desire
Thy coolness and Thy balm;
Let sense be dumb, let flesh retire;
Speak through the earthquake, wind, and fire,
O still, small voice of calm!`,
  },
  {
    id: 'am-353',
    number: '353',
    title: 'Praise, my soul, the King of heaven',
    tune: 'Praise, My Soul',
    lyrics: `Praise, my soul, the King of heaven;
To His feet thy tribute bring.
Ransomed, healed, restored, forgiven,
Who like me His praise should sing?
Praise Him! Praise Him!
Praise the everlasting King!

Praise Him for His grace and favour
To our fathers in distress.
Praise Him, still the same as ever,
Slow to chide, and swift to bless.
Praise Him! Praise Him!
Glorious in His faithfulness!

Father-like He tends and spares us;
Well our feeble frame He knows.
In His hands He gently bears us,
Rescues us from all our foes.
Praise Him! Praise Him!
Widely as His mercy flows!

Angels in the height, adore Him;
Ye behold Him face to face.
Saints triumphant, bow before Him;
Gathered in from every race.
Praise Him! Praise Him!
Praise with us the God of grace!`,
  },
  {
    id: 'am-197',
    number: '197',
    title: 'All people that on earth do dwell',
    tune: 'Old 100th',
    lyrics: `All people that on earth do dwell,
Sing to the Lord with cheerful voice;
Him serve with fear, His praise forth tell,
Come ye before Him and rejoice.

The Lord, ye know, is God indeed;
Without our aid He did us make;
We are His flock, He doth us feed,
And for His sheep He doth us take.

O enter then His gates with praise,
Approach with joy His courts unto;
Praise, laud, and bless His name always,
For it is seemly so to do.

For why? The Lord our God is good;
His mercy is for ever sure;
His truth at all times firmly stood,
And shall from age to age endure.

To Father, Son, and Holy Ghost,
The God whom heaven and earth adore,
From men and from the angel-host
Be praise and glory evermore.`,
  },
  {
    id: 'am-108',
    number: '108',
    title: 'When I survey the wondrous cross',
    tune: 'Rockingham',
    lyrics: `When I survey the wondrous cross
On which the Prince of glory died,
My richest gain I count but loss,
And pour contempt on all my pride.

Forbid it, Lord, that I should boast,
Save in the death of Christ my God!
All the vain things that charm me most,
I sacrifice them to His blood.

See from His head, His hands, His feet,
Sorrow and love flow mingled down!
Did e'er such love and sorrow meet,
Or thorns compose so rich a crown?

Were the whole realm of nature mine,
That were an offering far too small;
Love so amazing, so divine,
Demands my soul, my life, my all.`,
  },
  {
    id: 'am-134',
    number: '134',
    title: 'Jesus Christ is risen today',
    tune: 'Easter Hymn',
    lyrics: `Jesus Christ is risen today, Alleluia!
Our triumphant holy day, Alleluia!
Who did once, upon the cross, Alleluia!
Suffer to redeem our loss. Alleluia!

Hymns of praise then let us sing, Alleluia!
Unto Christ, our heavenly King, Alleluia!
Who endured the cross and grave, Alleluia!
Sinners to redeem and save. Alleluia!

But the pains which He endured, Alleluia!
Our salvation have procured, Alleluia!
Now above the sky He's King, Alleluia!
Where the angels ever sing. Alleluia!

Sing we to our God above, Alleluia!
Praise eternal as His love; Alleluia!
Praise Him, all ye heavenly host, Alleluia!
Father, Son, and Holy Ghost. Alleluia!`,
  },
  {
    id: 'am-205',
    number: '205',
    title: 'Love Divine, all loves excelling',
    tune: 'Blaenwern',
    lyrics: `Love Divine, all loves excelling,
Joy of heaven, to earth come down,
Fix in us Thy humble dwelling,
All Thy faithful mercies crown.
Jesu, Thou art all compassion,
Pure unbounded love Thou art;
Visit us with Thy salvation,
Enter every trembling heart.

Breathe, O breathe Thy loving Spirit
Into every troubled breast!
Let us all in Thee inherit,
Let us find that second rest;
Take away the love of sinning,
Alpha and Omega be;
End of faith, as its beginning,
Set our hearts at liberty.

Come, almighty to deliver,
Let us all Thy life receive;
Suddenly return, and never,
Never more Thy temples leave.
Thee we would be always blessing,
Serve Thee as Thy hosts above,
Pray, and praise Thee, without ceasing,
Glory in Thy perfect love.

Finish then Thy new creation,
Pure and spotless let us be;
Let us see Thy great salvation,
Perfectly restored in Thee;
Changed from glory into glory,
Till in heaven we take our place,
Till we cast our crowns before Thee,
Lost in wonder, love, and praise.`,
  },
  {
    id: 'am-196',
    number: '196',
    title: 'Guide me, O Thou great Redeemer',
    tune: 'Cwm Rhondda',
    lyrics: `Guide me, O Thou great Redeemer,
Pilgrim through this barren land;
I am weak, but Thou art mighty;
Hold me with Thy powerful hand:
Bread of heaven, Bread of heaven,
Feed me till I want no more.
Feed me till I want no more.

Open now the crystal fountain,
Whence the healing stream doth flow;
Let the fiery cloudy pillar
Lead me all my journey through:
Strong Deliverer, strong Deliverer,
Be Thou still my strength and shield.
Be Thou still my strength and shield.

When I tread the verge of Jordan,
Bid my anxious fears subside;
Death of death, and hell's destruction,
Land me safe on Canaan's side:
Songs of praises, songs of praises
I will ever give to Thee.
I will ever give to Thee.`,
  },
  {
    id: 'am-339',
    number: '339',
    title: 'Be Thou my vision, O Lord of my heart',
    tune: 'Slane',
    lyrics: `Be Thou my vision, O Lord of my heart,
Be all else naught to me, save that Thou art;
Be Thou my best thought in the day and the night,
Both waking and sleeping, Thy presence my light.

Be Thou my wisdom, and Thou my true word,
Be Thou ever with me, and I with Thee, Lord;
Be Thou my great Father, and I Thy true son;
Be Thou in me dwelling, and I with Thee one.

Be Thou my breastplate, my sword for the fight;
Be Thou my whole armor, be Thou my true might;
Be Thou my soul's shelter, be Thou my strong tower:
O raise Thou me heavenward, great Power of my power.

Riches I heed not, nor man's empty praise;
Be Thou my inheritance now and always;
Be Thou and Thou only the first in my heart,
O Sovereign of Heaven, my treasure Thou art.

High King of heaven, Thou heaven's bright Sun,
O grant me its joys after victory is won;
Great Heart of my own heart, whatever befall,
Still be Thou my vision, O Ruler of all.`,
  },
];

export const SUNG_LITURGY_SETTINGS: MusicalSetting[] = [
  {
    id: 'merbecke',
    title: 'Merbecke Communion Setting',
    composer: 'John Merbecke (1550)',
    parts: {
      Kyrie: 'Lord, have mercy upon us. Christ, have mercy upon us. Lord, have mercy upon us.',
      Gloria: 'Glory be to God on high, and in earth peace, good will towards men...',
      Sanctus: 'Holy, Holy, Holy, Lord God of hosts, heaven and earth are full of thy glory...',
      Benedictus: 'Blessed is he that cometh in the name of the Lord. Hosanna in the highest.',
      Agnus: 'O Lamb of God, that takest away the sins of the world, have mercy upon us.',
      Creed: 'I believe in one God the Father Almighty, Maker of heaven and earth...'
    }
  },
  {
    id: 'aston',
    title: 'Aston Communion Service',
    composer: 'Peter Aston',
    parts: {
      Kyrie: 'Lord, have mercy. Christ, have mercy. Lord, have mercy.',
      Gloria: 'Glory to God in the highest, and peace to his people on earth...',
      Sanctus: 'Holy, holy, holy Lord, God of power and might, heaven and earth are full of your glory...',
      Agnus: 'Lamb of God, you take away the sin of the world, have mercy on us.'
    }
  },
  {
    id: 'thorne',
    title: 'Mass of St Thomas',
    composer: 'David Thorne',
    parts: {
      Kyrie: 'Lord, have mercy. Christ, have mercy. Lord, have mercy.',
      Gloria: 'Glory to God in the highest, and peace to his people on earth...',
      Sanctus: 'Holy, holy, holy Lord, God of power and might, heaven and earth are full of your glory...',
      Agnus: 'Lamb of God, you take away the sin of the world, have mercy on us.'
    }
  }
];
