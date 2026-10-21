# Java 网络编程：NIO

[返回网络编程目录](/java/#网络编程) · 进阶阅读：[Netty](/java/Netty)



## Java NIO概述
### 阻塞IO
通常在进行同步I/O操作时，如果读取数据，代码会阻塞直至有可供读取的数据。同样，写入调用将会阻塞直至数据能够写入。传统的 Server/Client模式会基于TPR(Thread per Request),服务器会为每个客户端请求建立一个线程，由该线程单独负责处理一个客户请求。这种模式带来的一个问题就是线程数量的剧增，大量的线程会增大服务器的开销。大多数的实现为了避免这个问题，都采用了线程池模型，并设置线程池线程的最大数量，这由带来了新的问题，如果线程池中有 100个线程，而有100个用户都在进行大文件下载，会导致第 101个用户的请求无法及时处理，即便第101个用户只想请求一个几KB 大小的页面。传统的 Server/Client 模式如下图所示

![](https://cdn.nlark.com/yuque/0/2024/png/21718311/1723554512464-ce471d13-7c7b-4652-87e6-90a158fe86ed.png)

### 非阻塞IO（NIO）
NIO中非阻塞I/O采用了基于Reactor模式的工作方式，I/O调用不会被阻塞，相反是注册感兴趣的特定 事件，如可读数据到达，新的套接字连接等等，在发生特定事件时，系统再通知我们。NIO 中实现非阻塞I/O的核心对象就是Selector。

Selector就是注册各种I/O 事件地方，而且当我们感兴趣的事件发生时，就是这个对象告诉我们所发生的事件，如下图所示

![](https://cdn.nlark.com/yuque/0/2024/png/21718311/1723554664950-31e9fec9-0ecd-4695-905a-13ea847d1d73.png)

从图中可以看出，当有读或写等任何注册的事件发生时，可以从 Selector 中获得相应的SelectionKey，同时从 SelectionKey中可以找到发生的事件和该事件所发生的具体的SelectableChannel，以获得客户端发送过来的数据。

非阻塞指的是IO事件本身不阻塞，但是获取IO事件的select()方法是需要阻塞等待的。区别是阻塞的IO会阻塞在IO操作上，NIO阻塞在事件获取上没有事件就没有IO，从高层次看IO就不阻塞了。也就是说只有IO已经发生那么我们才评估IO是否阻塞，但是select()阻塞的时候IO还没有发生何谈的阻塞呢?NIO的本质是延迟I0操作到真正发生IO的时候，而不是以前的只要IO流打开了就一直等待IO操作。

|  IO  |  NIO  |
| --- | --- |
| 面向流（Stream Oriented） | 面向缓冲区（Buffer Oriented） |
| 阻塞IO（Blocking IO） | 非阻塞IO（Non Blocking IO） |
| 无 | 选择器（selectors） |


### NIO
Java Nio 由一下三个核心部分组成。

+ Channels
+ Buffers
+ Selectors

虽然Java NIO中除此之外还有很多类和组件，单Channel，Buffer和Selector构成了核心的API。其他组件，如Pipe和FileLock，只不过是与三个核心组件共同使用的工具类。



#### Channel
Channel，可以翻译成“通道”。Channel和IO中的Stream（流）是差不多一个等级的。只不过Stream是单向的，譬如：InputStream，OutputSteam。而Channel是双向的，既可以用来进行读写操作，又可以用来进行写操作。



NIO中的Channel的主要实现有：FileChannel、DatagramChannel、SocketChannel和ServerSocketChannel，这里看名字就可以猜出：分别可以对应文件IO、UDP和TCP（Server和Client）



#### Buffer
NIO中的关键Buffer实现有：ByteBuffer，CharBuffer，DoubleBuffer，FloatBuffer，IntBuffer，LongBuffer，ShortBuffer，分别对应基本数据类型：byte，char，double，float，int，long，short。

#### Selecotr
Selector运行单线程处理多个Channel，如果你的应用打开了多个通道，但每个连接的流量都很低，使用Selector就会很方便。例如在一个聊天服务器中。要使用Selector，得想Selector中注册Channel，然后调用他的select（）方法。这个方法会一直阻塞到某个注册的通道有事件就绪。一旦这个方法返回，线程就可以处理这些事件，事件的例子有如新的连接进来、数据接受等。

## NIO (Channel)
### Channel概述
Channel是一个通道，可以通过它写入和读取数据，他就像水管一样，网络数据通过Channel读取和写入。通道与流的不同在于，流式单向移动的（一个流必须是InputStream或者OutpStream的子类），而通道是双向的，可以用于读、写或者同时用于读写。因为Channel是全双工的，所以它可以比流更好的映射底层操作系统的API。



NIO中通过channel封装了对数据源的操作，通过channel我们可以操作数据源，但又不比关系数据源的具体物理结构。这个数据源可能是多种的。比如，可以是文件，也可以是网络socket。在大多数应用中，channel与文件描述符或者是socket是一一对应的。Channel用于在字节缓冲区和位于通道另一侧的实体（通常是一个文件或套接字）之间有效的传输数据。

```java
public interface Channel extends Closeable {
    public boolean isOpen();

    public void close() throws IOException;
}
```

与缓冲区不同，通道API主要由接口指定。不同的操作系统上通道的实现（Channel Implementation）会有根本性的差异，所以通道API仅仅描述了可以做什么。因此很自然的，通道实现经常使用操作系统的本地代码。通道接口允许你以一种受控且可移植的方式来访问底层的IO的服务。



Channel是一个对象，可以通过它读取和写入数据。拿NIO与原来的I/O做个比较，通道就像是流。所有的数据都通过对Buffer对象来处理。你永远不会将字节直接写入到通道中，相反，你是将数据写入包喊一个或者多个字节的缓冲区。同样，你不会直接从通道汇总读取字节，而是将数据从通道读入缓冲区，再从缓冲区获取这个字节。

###
Java NIO 的通道类似流，但又有些不同：

+ 既可以从通道中读取数据，又可以写数据到通道。但流的读写通常是单向的。
+ 通道可以异步的读写。
+ 通道中的数据总是要先读到一个Buffer，或者总是要从一个Buffer中写入。

正如上面所说，从通道读取数据到缓冲区，从缓冲区写入数据到通道。如下图：

![](https://cdn.nlark.com/yuque/0/2024/png/21718311/1723557104436-144c71e4-b132-4397-951d-113fb6834738.png)

### Channel实现
+ FileChannel : 从文件中读写数据。
+ DatagramChannel ： 能通过UDP读写网络中的数据。
+ SocketChannel ：能通过TCP读写网络中的数据。
+ ServerSocketChannel ：可以监听新进来的TCP连接，像Web服务器那样。对每个新进来的连接都会创建一个SocketChannel。

这些通道涵盖了UDP和TCP网络IO，以及文件IO。



### FileChannel介绍和代码示例
FileChannel类可以实现常用的write，read以及scatter、gather操作。同时它也提供了很多专用于文件的新方法。这些方法中很多都是熟悉的文件操作。

|  方法  |  描述  |
| --- | --- |
| int read(ByteBuffer dst) | 从Channel中读取数据到ByteBuffer |
| long read(ByteBuffer[] dsts) | 将Channel中的数据“分散”到ByteBuffer[] |
| int write(ByteBuffer src) | 将ByteBuffer中的数据写入到Channel |
| long write(ByteBuffer[] srcs) | 将ByteBuffer[] 中的数据“聚集”到Channel |
| long position() | 返回此通道的文件位置 |
| FileChannel position(long p) | 设置此通道的文件位置 |
| long size() | 返回此通道的文件的当前大小 |
| FileChannel truncate(long s)  | 将此通道的文件截取为给定大小 |
| void force(boolean metaData) | 强制将所有对此通道的文件更新写入到存储设备中 |


示例，将一个文件读到buffer中

```java
public class FileChannelDemo01 {
    // FileChannel 读取数据到buffer中
    public static void main(String[] args) throws Exception {

        // 创建一个 FileChannel
        RandomAccessFile accessFile = new RandomAccessFile("E:\\桌面\\新建文本文档.txt", "rw");
        FileChannel channel = accessFile.getChannel();

        // 创建Buffer
        ByteBuffer buffer = ByteBuffer.allocate(1024);

        // 读取数据到buffer中
        int byteRead =  channel.read(buffer);
        while(byteRead != -1){
            System.out.println("读取了："+byteRead);
            // 切换读写
            buffer.flip();
            while (buffer.hasRemaining()){
                System.out.print((char) buffer.get());
            }
            // 清空缓冲区
            buffer.clear();
            byteRead = channel.read(buffer);
        }
        accessFile.close();
        System.out.println("读取完毕");
    }
}
```

Buffer的常用操作：

+ 将数据写入缓冲区
+ 调用buffer.flip()反转读写模式。
+ 从缓冲区读写数据
+ 调用buffer.clear()或buffer.compact()清除缓冲区内容

### FileChannel操作详解
#### 打开FileChannel
在使用FileChannel之前，必须先打开它。但是，我们无法直接打开一个FileChannel，需要通多使用一个InputStream、OutputStream或RandomAccessFile来获取一个FileChannel实例。

下面是一个通过RandomAccessFile打开FileChannel的示例：

```java
 RandomAccessFile accessFile = new RandomAccessFile("E:\\桌面\\新建文本文档.txt", "rw");
FileChannel channel = accessFile.getChannel();
```

#### 从FileChannel中读取数据
调用多个read()方法从FileChannel读取数据。如：

```java
// 创建Buffer
ByteBuffer buffer = ByteBuffer.allocate(1024);

// 读取数据到buffer中
int byteRead =  channel.read(buffer);
```

首先，分配一个Buffer。从FileChannel中读取的数据将被读到Buffer中。然后，调用FileChannel.read()方法。该方法将数据从FileChannel读取到Buffer中。read（）方法返回的int值表示了有多少个字节被读取到了Buffer中。如果返回-1，表示到了文件末尾。

#### 向FileChannel中写数据
使用FileChannel.write()方法向FileChannel写数据。该方法的参数是一个Buffer。如：

```java
public class FileChannelDemo02 {
    public static void main(String[] args) throws Exception {
        //打开FileChannel
        RandomAccessFile accessFile = new RandomAccessFile("E:\\桌面\\02.txt", "rw");
        FileChannel channel = accessFile.getChannel();

        // 创建Buffer对象
        ByteBuffer buffer = ByteBuffer.allocate(1024);

        String data = "Hello,JavaNIO!";
        buffer.clear();

        // 将数据写入Buffer
        buffer.put(data.getBytes());

        buffer.flip();

        //FileChannel 完成最终实现
        while (buffer.hasRemaining()){
            channel.write(buffer);
        }

        // 关闭通道
        channel.close();
    }
}
```



注意 FileChannel.write()是在[while 循环中调用的。因为无法保证 write()方法一次能向 FileChannel写入多少字节，因此需要重复调用 write()方法，直到 Buffer 中已经没有尚未写入通道的字节。



#### 关闭FileChannel
用完FileChannel后必须将通道关闭

```java
  // 关闭通道
channel.close();
```



#### FileChannel的position方法
有时可能需要在 FileChannel 的某个特定位置进行数据的读/写操作。可以通过调用position()方法获取 FileChannel的当前位置。也可以通过调用 position(long pos)方法设置 FileChannel的当前位置。

这里有两个例子:

```java
long pos = channel.position();
channel.position(pos +123);
```

+ 如果将位置设置在文件结束符之后，然后试图从文件通道中读取数据，读方法将返回(文件结束标志)。
+ 如果将位置设置在文件结束符之后，然后向通道中写数据，文件将撑大到当前位置并写入数据。这可能导致“文件空洞”磁盘上物理文件中写入的数据间有空隙。

#### FileChannel的size()方法
FileChannel实例的 size()方法将返回该实例所关联文件的大小。如:

```java
long fileSize = channel.siz&();
```



#### FileChannel的truncate（）方法
可以使用 FileChannel.truncate()方法截取一个文件。截取文件时，文件将中指定长度后面的部分将被删除。如:

```java
channel.truncate(1024);
```

这个例子截取文件的前 1024 个字节。



#### FileChannel的force方法
FileChannel.force()方法将通道里尚未写入磁盘的数据强制写到磁盘上。出于性能方面的考虑，操作系统会将数据缓存在内存中，所以无法保证写入到 FileChannel里的数据一定会即时写到磁盘上。要保证这一点，需要调用 force()方法。

force()方法有一个 boolean 类型的参数，指明是否同时将文件元数据(权限信息等)写到磁盘上。



#### FileChannel的transferTo和transferFrom方法
通道之间的数据传输：

如果两个通道之间有一个是FileChannel，那你可以直接将数据从一个channel传输到另一个channel。

1. transferFrom()

FileChannel的 transferFrom()方法可以将数据从源通道传输到 FileChannel中(译者注:这个方法在 JDK 文档中的解释为将字节从给定的可读取字节通道传输到此通道的文件中)。下面是一个 FileChannel完成文件间的复制的例子:

```java
public class FileChannelDemo03 {

    public static void main(String[] args) throws Exception {
        //打开两个 FileChannel
        RandomAccessFile a = new RandomAccessFile("E:\\桌面\\02.txt", "rw");
        FileChannel fromChannel = a.getChannel();
        RandomAccessFile b = new RandomAccessFile("E:\\桌面\\01.txt", "rw");
        FileChannel toChannel = b.getChannel();

        // from -> to中
        int position = 0;
        int size = (int) fromChannel.size();
        toChannel.transferFrom(fromChannel,position , size);

        a.close();
        b.close();
        System.out.println("over");

    }
}
```



2. transferTo

transferTo()方法将数据从 FileChannel传输到其他的 channel 中。下面是一个 transferTo()方法的例子:

```java
public class FileChannelDemo04 {

    public static void main(String[] args) throws Exception {
        //打开两个 FileChannel
        RandomAccessFile a = new RandomAccessFile("E:\\桌面\\01.txt", "rw");
        FileChannel fromChannel = a.getChannel();
        RandomAccessFile b = new RandomAccessFile("E:\\桌面\\02.txt", "rw");
        FileChannel toChannel = b.getChannel();

        // from -> to中
        int position = 0;
        int size = (int) fromChannel.size();
        fromChannel.transferTo(position, size, toChannel);
        a.close();
        b.close();
        System.out.println("over");

    }
}
```

### Socket通道
(1). 新的 socket 通道类可以运行非阻塞模式并且是可选择的，可以激活大程序(如网络服务器和中间件组件)巨大的可伸缩性和灵活性。本节中我们会看到，再也没有为每个 socket 连接使用一个线程的必要了，也避免了管理大量线程所需的上下文交换开销。借助新的 NIO 类，一个或几个线程就可以管理成百上千的活动 socket 连接了并且只有很少甚至可能没有性能损失。所有的 socket通道类(DatagramChannel、SocketChannel和ServerSocketChannel)都继承了位于java.nio.channels.spi 包中的 AbstractSelectableChannel。这意味着我们可以用一个Selector 对象来执行socket通道的就绪选择(readinessselection)。

(2) 请注意 DatagramChannel和 Socketthannel实现定义读和写功能的接口而ServerSocketChannel不实现。ServerSocketChannel负责监听传入的连接和创建新的 SocketChannel对象，它本身从不传输数据。

(3)在我们具体讨论每一种 socket 通道前，您应该了解 socket 和 socket 通道之间的关系。通道是一个连接 I/O 服务导管并提供与该服务交互的方法。就某个socket 而言，它不会再次实现与之对应的 socket 通道类中的 socket 协议 APl，而java.net 中已经存在的 socket 通道都可以被大多数协议操作重复使用。

全部 socket 通道类(DatagramChannel.SocketChannel 和ServerSocketChannel)在被实例化时都会创建一个对等socket 对象。这些是我们所熟悉的来自java.net的类(Socket、ServerSocket和DatagramSocket)，它们已经被更新以识别通道。对等 socket 可以通过调用 socket( )方法从一个通道上获取。此外，这三个java.net 类现在都有 getChannel()方法。

(4)要把一个 socket通道置于非阻塞模式，我们要依靠所有 socket 通道类的公有超级类:SelectableChanne!。就绪选择(readiness selection)是一种可以用来查询通道的机制，该查询可以判断通道是否准备好执行一个目标操作，如读或写。非阻塞 I/0 和可选择性是紧密相连的，那也正是管理阻塞模式的 API代码要在SelectableChannel超级类中定义的原因。

设置或重新设置一个通道的阻塞模式是很简单的，只要调用configureBlocking()方法即可，传递参数值为 true 则设为阻塞模式，参数值为 false 值设为非阻塞模式。可以通过调用 isBlocking()方法来判断某个 socket 通道当前处于哪种模式。 true=阻塞、false=非阻塞

```java
public final SelectableChannel configureBlocking(boolean block)
throws IOException
{
    synchronized (regLock) {
        if (!isOpen())
            throw new ClosedChannelException();
        if (blocking == block)
            return this;
        if (block && haveValidKeys())
            throw new IllegalBlockingModeException();
        implConfigureBlocking(block);
        blocking = block;
    }
    return this;
}
```

#### ServerSocketChannel
ServerSocketChannel是一个基于通道的 socket 监听器。它同我们所熟悉的java.net.ServerSocket执行相同的任务，不过它增加了通道语义，因此能够在非阻塞模式下运行。

由于 ServerSocketChannel没有 bind()方法，因此有必要取出对等的 socket 并使用它来绑定到一个端口以开始监听连接。我们也是使用对等ServerSocket的 API来根据需要设置其他的 socket 选项。

同java.net.ServerSocket一样，ServerSocketChannel也有 accept( )方法。一旦创建了一个 ServerSocketChannel 并用对等 socket 绑定了它，然后您就可以在其中一个上调用 accept()。如果您选择在 ServerSocket 上调用 accept( )方法，那么它会同任何其他的 ServerSocket 表现一样的行为:总是阻塞并返回一个java.net.Socket 对象。如果您选择在 ServerSocketChannel上调用 accept()方法则会返回SocketChannel类型的对象，返回的对象能够在非阻塞模式下运行。

换句话说:

ServerSocketChannel的 accept()方法会返回 SocketChannel类型对象SocketChannel可以在非阻塞模式下运行。

其它 Socket的 accept()方法会阻塞返回一个 Socket 对象。如果ServerSocketChannel以非阻塞模式被调用，当没有传入连接在等待时ServerSocketChannel.accept()会立即返回 nul。正是这种检查连接而不阻塞的能力实现了可伸缩性并降低了复杂性。可选择性也因此得到实现。我们可以使用一个选择器实例来注册ServerSocketChannel 对象以实现新连接到达时自动通知的功能。



1. 打开ServerSocketChannel

通过调用

```java
ServerSocketChannel.open();//方法来打开 ServerSocketChannel
ServerSocketChannel serverSocketChannel =ServerSocketChannel.open();
```

2. 关闭ServerSocketChannel

通过调用 erverSocketChannel.close();//方法来关闭 ServerSocketChannel

```java
serverSocketChannel.close();
```

3. 监听新的连接

通过 ServerSocketChannel.accept()方法监听新进的连接。当 accept()方法返回时候,它返回一个包含新进来的连接的 SocketChannel。因此,accept()方法会一直阻塞到有新连接到达。

通常不会仅仅只监听一个连接,在 while 循环中调用 accept()方法.如下面的例子:

```java
while (true) {
        System.out.println("waiting 。。。");
        SocketChannel channel = ssc.accept();
}
```

4. 阻塞模式

会在这行阻塞

```java
 SocketChannel channel = ssc.accept();
```

5. 非阻塞模式

ServerSocketChannel可以设置成非阻塞模式。在非阻塞模式下，accept()方法会立刻返回，如果还没有新进来的连接,返回的将是 null。因此，需要检查返回的SocketChannel是否是 null.如:

```java
public class ServerSocketChannelDemo {

    public static void main(String[] args) throws IOException {
        int port = 8888;

        // buffer
        ByteBuffer buffer = ByteBuffer.wrap("hello buffer".getBytes());

        // ServerSocketChannel
        ServerSocketChannel ssc = ServerSocketChannel.open();
        ServerSocket socket = ssc.socket();
        // 绑定
        socket.bind(new InetSocketAddress(port));
        // 设置非阻塞模式
        ssc.configureBlocking(false);
        // 监听是否有新的连接
        while (true) {
            System.out.println("waiting 。。。");
            SocketChannel channel = ssc.accept();
            if(channel == null) {
                System.out.println("没有新的连接");
                try{TimeUnit.SECONDS.sleep(2);}catch (InterruptedException e){e.printStackTrace();}
            }else {
                System.out.println("有新的连接:"+channel.socket().getRemoteSocketAddress());
                buffer.rewind();//指针指向0
                channel.write(buffer);
                channel.close();
            }

        }

    }
}
```



#### SocketChannel
Java NIO 中的 SocketChannel是一个连接到 TCP 网络套接字的通道。

A selectable channel for stream-oriented connecting sockets.

以上是 Java docs 中对于 SocketChanne!的描述:SocketChannel是一种面向流连接sockets 套接字的可选择通道。从这里可以看出:

+ SocketChannel是用来连接 Socket 套接字
+ SocketChannel主要用来处理网络I/O通道
+ SocketChannel是基于TCP连接传输
+ SocketChannel实现了可选择通道，实现多路复用

##### SocketChannel特征：
(1)对于已经存在的 socket 不能创建 SocketChanne!

(2)SocketChannel中提供的 open 接口创建的 Channel 并没有进行网络级联，需要使用 connect 接口连接到指定地址

(3)未进行连接的 SocketChannle执行I/O 操作时，会抛出NotYetConnectedExceptione

(4)SocketChannel 支持两种 I/O模式:阻塞式和非阻塞式

(5)SocketChannel支持异步关闭。如果SocketChannel在一个线程上read 阻塞，另一个线程对该SocketChannel 调用 shutdownlnput，则读阻塞的线程将返回-1 表示没有读取任何数据;如果 SocketChanne!在一个线程上 write 阻塞，另一个线程对该SocketChanne!调用shutdownWrite，则写阻塞的线程将抛出AsynchronousCloseException

(6)SocketChannel支持设定参数

SO_SNDBUF 套接字发送缓冲区大小

SO_RCVBUF 套接字接收缓冲区大小

SO_KEEPALIVE 保活连接

O_REUSEADDR 复用地址

SO_LINGER 有数据传输时延缓关闭 Channel(只有在非阻塞模式下有用)

TCP_NODELAY 禁用 Nagle 算法

##### SocketChannel使用
1. 创建SocketChannel

方式一：

```java
SocketChannel socketChannel = SocketChannel.open(new InetSocketAddress("www.baidu.com",80));
```

方式二：



```java
SocketChannel channel2 = SocketChannel.open();
channel2.connect(new InetSocketAddress("www.baidu.com",80));
```

直接使用有参 open api或者使用无参 open api，但是在无参 open 只是创建了一个SocketChanne!对象，并没有进行实质的tcp连接。



2. 连接校验

```java
socketChannel.isOpen(); //测试SocketChannel是否为open状态
socketChannel.isConnected(); //测试socketChannel是否已经被连接
socketChannel.isConnectionPending(); //测试socketChannel是否正在进行连接
socketChannel.finsihConnect(); //校验正在进行套接字的socketChannel是否已经完成连接
```

3. 读写模式

前面提到SocketChannel支持阻塞和非阻塞两种模式:

```java
socketChannel。configureBlocking(false);
```

通过以上方法设置SocketChannel的读写模式。false表示非阻塞，true表示阻塞。



4. 读写

```java
SocketChannel socketChannel = SocketChannel.open(new InetSocketAddress("www.baidu.com",80));
ByteBuffer byteBuffer = ByteBuffer.allocate(16);
socketChannel.read(byteBuffer);
socketChannel.close();
System.out.println("read over");
```

以上为阻塞式读，当执行到read出，线程将阻塞，控制台将无法打印read over



```java
SocketChannel socketChannel = SocketChannel.open(new InetSocketAddress("www.baidu.com",80));
socketChannel.configureBlocking(false);
ByteBuffer byteBuffer = ByteBuffer.allocate(16);
socketChannel.read(byteBuffer);
socketChannel.close();
System.out.println("read over");
```

以上为非阻塞读，控制台将打印read over

读写都是面向缓冲区，这个读写方式与文中FileChannel相同。

5. 设置和获取参数

```java
socketChannel.setOption(StandardSocketOption.SO_KEEPALIVE,Boolean.TRUE)
    .setOption(StandardSocketOption.TCP_NODELAY,Boolean.TRUE);
```

通过setOption方法可以设置soket套接字的相关参数。

#### DatagramChannel
正如SocketChannel对应Socket,ServerSocketChannel对应ServerSocket，每一个 DatagramChannel 对象也有一个关联的 DatagramSocket 对象。正如SocketChannel模拟连接导向的流协议(如TCP/IP)，DatagramChannel则模拟包导向的无连接协议(如 UDP/IP)。DatagramChannel是无连接的，每个数据报(datagram)都是一个自包含的实体，拥有它自己的目的地址及不依赖其他数据报的数据负载。与面向流的的socket 不同，DatagramChannel可以发送单独的数据报给不同的目的地址。同样，DatagramChannel对象也可以接收来自任意地址的数据包。每个到达的数据报都含有关于它来自何处的信息(源地址)



1. 打开DatagramChannel

```java
DatagramChannel server = DatagramChannel.open();
server.socket().bind(new InetSocketAddress(10086));
```

此例子是打开10086端口接收UDP数据包



2. 接受数据

通过receive()接收UDP包

```java
ByteBuffer receiveBuffer = ByteBuffer.allocate(64);
receiveBuffer.clear();
SocketAddress receiveAddr = server.receive(receiveBuffer);
```

SocketAddress 可以获得发包的ip、端口等信息，用toString查看

格式如下

```java
/127.0.0.57126
```

3. 发送数据

通过send()发送UDP包

```java
DatagramChannel server = DatagramChannel.open();
ByteBuffer sendBuffer = ByteBuffer.wrap("client send".getBytes());
server.send(sendBuffer,new InetSocketAddress("127.0.0.1",10086));
```

4. 连接

UDP不存在真正意义上的连接，这里的连接是向特定服务地址用read和wirte接收发送数据包。

```java
client.connet(new InetSocketAddress("127.0.0.1",100086));
int readSize = clinet.read(sendBuffer);
server.write(sendBuffer);
```

read()和write()只有connect()后才能使用，不然抛出NotYetConnectedException异常。用read()接收时，如果没有接收到包，会抛出PortUnreachableException异常。

5. DatagramChannel示例

客户端发送，服务端接收的例子

```java
public class DatagramChannelDemo {
    // 发送的实现
    @Test
    public void sendDatagram() throws Exception {
        // 打开DatagramChannel
        DatagramChannel sendChannel = DatagramChannel.open();
        InetSocketAddress sendAddr = new InetSocketAddress("127.0.0.1", 9999);
        // 发送数据
        while (true) {
            ByteBuffer buffer = ByteBuffer.wrap("发送数据".getBytes(StandardCharsets.UTF_8));
            sendChannel.send(buffer,sendAddr);
            System.out.println("发送数据成功");
            try{
                TimeUnit.SECONDS.sleep(2);}catch (InterruptedException e){e.printStackTrace();}
        }
    }

    // 接收的实现
    @Test
    public void receiveDatagram() throws Exception {
        // 打开DatagramChannel
        DatagramChannel receiveChannel = DatagramChannel.open();
        InetSocketAddress receiveAddr = new InetSocketAddress(9999);
        // 绑定
        receiveChannel.bind(receiveAddr);
        ByteBuffer receiveBuffer = ByteBuffer.allocate(1024);

        // 接收数据
        while(true) {
            receiveBuffer.clear();
            SocketAddress socketAddress = receiveChannel.receive(receiveBuffer);
            receiveBuffer.flip();
            System.out.println(socketAddress.toString());
            System.out.println("接收数据成功:"+ StandardCharsets.UTF_8.decode(receiveBuffer));
        }

    }

}
```

连接示例

```java
// 连接 read 和 write
@Test
public void testConnect() throws Exception {
// 打开DatagramChannel
DatagramChannel connChannel = DatagramChannel.open();
// 绑定
connChannel.bind(new InetSocketAddress(9999));

// 连接
connChannel.connect(new InetSocketAddress("127.0.0.1", 9999));

connChannel.write(ByteBuffer.wrap("连接成功".getBytes()));
ByteBuffer buffer = ByteBuffer.allocate(1024);
while (true){
    buffer.clear();
    connChannel.read(buffer);
    buffer.flip();
    System.out.println("接收数据:"+ StandardCharsets.UTF_8.decode(buffer));
}

}
```

### Scatter/Gather
Java NIO 开始支持 scatter/gather，scatter/gather 用于描述从 Channel 中读取或者写入到 Channel的操作。

+ 分散(scatter)从 Channel中读取是指在读操作时将读取的数据写入多个buffer中。因此，Channel将从 Channel中读取的数据“分散(scatter)”到多个 Buffer中。
+ 聚集(gather)写入Channel是指在写操作时将多个 buffer 的数据写入同一个Channel，因此，Channel将多个 Buffer中的数据“聚集(gather)”后发送到Channel。

scatter/gather 经常用于需要将传输的数据分开处理的场合，例如传输一个由消息头和消息体组成的消息，你可能会将消息体和消息头分散到不同的 buffer 中，这样你可以方便的处理消息头和消息体。



#### Scatter Reads
Scattering Reads 是指数据从一个 channel读取到多个 buffer 中。如下图描述:

![画板](https://cdn.nlark.com/yuque/0/2024/jpeg/21718311/1723643919575-8e3ef60c-4bb3-492e-a71f-e7a47d5615e3.jpeg)



```java
ByteBuffer header = new ByteBuffer.allocate(128);
ByteBuffer body = new ByteBuffer.allocate(1024);

ByteBuffer[] bufferArray = {header , body};
channel.read(bufferArray);
```

注意 buffer 首先被插入到数组，然后再将数组作为 channel.read() 的输入参数。read()方法按照 buffer 在数组中的顺序将从 channel中读取的数据写入到 buffer，当一个 buffer 被写满后，channel 紧接着向另一个 buffer 中写。



Scattering Reads 在移动下一个 buffer 前，必须填满当前的 buffer，这也意味着它不适用于动态消息(译者注:消息大小不固定)。换句话说，如果存在消息头和消息体消息头必须完成填充(例如 128byte)，Scattering Reads才能正常工作。



#### Gather Writes
Gather Writes是指从多个buffer，写入到一个channel。如下图描述：

![画板](https://cdn.nlark.com/yuque/0/2024/jpeg/21718311/1723644247537-b05b0516-8793-481a-bf7a-798c21a60b92.jpeg)



```java
ByteBuffer header = new ByteBuffer.allocate(128);
ByteBuffer body = new ByteBuffer.allocate(1024);

ByteBuffer[] bufferArray = {header , body};
channel.write(bufferArray);
```

buffers 数组是 write()方法的入参，write()方法会按照 buffer 在数组中的顺序，将数据写入到 channel，注意只有 position 和 limit 之间的数据才会被写入。因此，如果一个 buffer 的容量为 128byte，但是仅仅包含 58byte 的数据，那么这 58byte 的数据将被写入到 channel中。因此与 Scattering Reads 相反，Gathering Writes 能较好的处理动态消息。

## NIO (Buffer)
### Buffer简介
Java NIO 中的 Buffer 用于和 NIO 通道进行交互。数据是从通道读入缓冲区，从缓冲区写入到通道中的。

![画板](https://cdn.nlark.com/yuque/0/2024/jpeg/21718311/1723644741519-f26e710f-d554-46a8-9667-d824249847b5.jpeg)

缓冲区本质上是一块可以写入数据，然后可以从中读取数据的内存。这块内存被包装成 NIO Buffer 对象，并提供了一组方法，用来方便的访问该块内存。缓冲区实际上是一个容器对象，更直接的说，其实就是一个数组，在 NIO 库中，所有数据都是用缓冲区处理的。在读取数据时，它是直接读到缓冲区中的，在写入数据时，它也是写入到缓冲区中的;任何时候访问 NIO 中的数据，都是将它放到缓冲区中。而在面向流IO系统中，所有数据都是直接写入或者直接将数据读取到 Stream 对象中。

在 NIO 中，所有的缓冲区类型都继承于抽象类 Buffer，最常用的就是 ByteBuffer对于 Java 中的基本类型，基本都有一个具体 Buffer 类型与之相对应，它们之间的继承关系如下图所示:

![](https://cdn.nlark.com/yuque/0/2024/png/21718311/1723645324331-4eb7707c-d9c1-452a-b623-a63102b689fd.png)

### Buffer的基本用法
1. 使用Buffer进行读写数据，一般遵循以下四个原则：

（1）写入数据到Buffer

（2）调用flip()方法

（3）从Buffer中读取数据

（4）调用clear（）或compact（）方法

当向 buffer 写入数据时，buffer 会记录下写了多少数据。一旦要读取数据，需要通过flip()方法将 Buffer 从写模式切换到读模式。在读模式下，可以读取之前写入到 buffer的所有数据。一旦读完了所有的数据，就需要清空缓冲区，让它可以再次被写入。有两种方式能清空缓冲区:调用 clear()或 compact()方法。clear()方法会清空整个缓冲区。compact()方法只会清除已经读过的数据。任何未读的数据都被移到缓冲区的起始处，新写入的数据将放到缓冲区未读数据的后面。



2. 使用Buffer例子

```java
@Test
public void buffer01() throws Exception {
// 创建一个 FileChannel
RandomAccessFile accessFile = new RandomAccessFile("E:\\桌面\\新建文本文档.txt", "rw");
FileChannel channel = accessFile.getChannel();

// 创建Buffer
ByteBuffer buffer = ByteBuffer.allocate(1024);

// 读取数据到buffer中 读到-1表示读完了
int byteRead =  channel.read(buffer);
while(byteRead != -1){
    System.out.println("读取了："+byteRead);
    // 切换读写
    buffer.flip();
    while (buffer.hasRemaining()){
        System.out.print((char) buffer.get());
    }
    // 清空缓冲区
    buffer.clear();
    byteRead = channel.read(buffer);
}
accessFile.close();
System.out.println("读取完毕");
}
```

3. IntBuffer例子

```java
@Test
public void buffer02() throws Exception {

IntBuffer buffer = IntBuffer.allocate(8);

for (int i = 0; i < buffer.capacity(); i++) {
    buffer.put(i);
}
// 切换读写
buffer.flip();

//
while (buffer.hasRemaining()) {
    System.out.println(buffer.get());
}
}
```



### Buffer的capacity、position和limit
为了理解Buffer的工作原理，需要了解Buffer的三个属性：

+ capacity
+ position
+ limit

position和limit的含义取决于Buffer处在度模式下还是写模式。不管Buffer处在什么模式，capacity的含义总是一样的。

关于capacity，position和limit在读写模式中的说明

![](https://cdn.nlark.com/yuque/0/2024/png/21718311/1723776519573-2452ae6a-6ab5-435b-b8f0-5c84aa48c7f9.png)

（1）capacity

作为一个内存块，Buffer有一个固定的大小值，也叫“capacity”你只能往里写capacity个byte、long、char等类型。一旦Buffer满了，需要将其清空（通过读数据或这清除数据）才能继续往里写数据。

（2）position

1)写数据到 Buffer 中时，position 表示写入数据的当前位置，position 的初始值为0。当一个 byte、long 等数据写到 Buffer后， position 会向下移动到下一个可插入数据的 Buffer 单元。position 最大可为 capacity-1(因为 position 的初始值为0

2)读数据到 Buffer 中时，position 表示读入数据的当前位置，如 position=2 时表示已开始读入了3个byte，或从第3个byte 开始读取。通过 ByteBuffer.flip()切换到读模式时 position 会被重置为 0，当 Buffer 从 position 读入数据后，position 会下移到下一个可读入的数据 Buffer 单元。

（3）limit

1)写数据时，limit 表示可对 Buffer 最多写入多少个数据。写模式下，limit 等于Buffer 的 capacity。

2)读数据时，limit 表示 Buffer 里有多少可读数据(not null 的数据)，因此能读到之前写入的所有数据(limit 被设置成已写数据的数量，这个值在写模式下就是position)。



###  Buffer 的类型
Java NIO 有以下 Buffer 类型

+ BytsBuffere
+ MappedByteBuffer
+ CharBuffere
+ DoubleBuffere
+ FloatBuffere
+ IntBuffere
+ LongBuffere
+ ShortBuffere

这些 Buffer 类型代表了不同的数据类型。换句话说，就是可以通过 char，shortint，long，float 或 double 类型来操作缓冲区中的字节。



### Buffer分配和写数据
1. Buffer分配

要想获得一个 Buffer 对象首先要进行分配。每一个 Buffer 类都有一个 allocate 方法。

下面是一个分配 48 字节 capacity的 ByteBuffer 的例子。

```java
ByteBuffer buf = ByteBuffer.allocate(48);
```

这是分配一个可存储 1024 个字符的 CharBuffer:

```java
CharBuffer buf = CharBuffer.allocate(1024);
```

2. 向Buffer写数据

写数据有两种方式

（1）从Channe写到Buffer

从 Channel写到 Buffer 的例子

```java
int bytesRead = inChannel.read(buf); //read into buffer.
```

（2）通过Buffer的put（）方法写到Buffer里。

通过put（）方法写到Buffer例子

buf.put（127）；

put方法有很多版本，允许你以不同的方式把数据写入到 Buffer中。例如，写到一个指定的位置，或者把一个字节数组写入到 Buffer

3. flip（）方法

flip 方法将 Buffer 从写模式切换到读模式。调用 flip()方法会将 position 设回0，并将 limit 设置成之前 position 的值。换句话说，position 现在用于标记读的位置,limit 表示之前写进了多少个 byte、char等(现在能读取多少个 byte、char 等)。

### 从Buffer读数据
**从 Buffer 中读取数据有两种方式:**

(1)从 Buffer 读取数据到 Channel。

(2)使用 get()方法从 Buffer 中读取数据。

**从 Buffer 读取数据到 Channel 的例子:**

//read from buffer into channel.

```java
int bytesWritten =inChannel.write(buf);
```

**使用 get()方法从 Buffer 中读取数据的例子**

```java
byte aByte = buf.get();
```

get方法有很多版本，允许你以不同的方式从 Buffer中读取数据。例如，从指定position 读取，或者从 Buffer 中读取数据到字节数组。



### Buffer中的几个方法
1、rewind（）方法

Buffer.rewind()将 position 设回0，所以你可以重读 Buffer 中的所有数据。limit 保持不变，仍然表示能从 Buffer中读取多少个元素(byte、char等)。

2、clear（）与compact（）方法

一旦读完 Buffer 中的数据，需要让 Buffer 准备好再次被写入。可以通过 clear()或compact()方法来完成。

如果调用的是 clear()方法，position 将被设回0，limit 被设置成 capacity 的值。换句话说，Buffer 被清空了。Buffer 中的数据并未清除，只是这些标记告诉我们可以从哪里开始往 Buffer 里写数据。

如果 Buffer 中有一些未读的数据，调用 clear()方法，数据将“被遗忘”，意味着不再有任何标记会告诉你哪些数据被读过，哪些还没有。

如果 Buffer 中仍有未读的数据，且后续还需要这些数据，但是此时想要先先写些数据，那么使用 compact()方法。

compact()方法将所有未读的数据拷贝到 Buffer 起始处。然后将 position 设到最后个未读元素正后面。limit 属性依然像 clear()方法一样，设置成 capacity。现在Buffer 准备好写数据了，但是不会覆盖未读的数据。

3、mark（）和reset（）方法

通过调用 Buffer.mark()方法，可以标记 Buffer 中的一个特定 position。之后可以通过调用 Buffer.reset()方法恢复到这个 position。例如:

```java
buffer.mark();
// call buffer.get() a couple of times ,e.g. during parsing.
buffer.reset(); // set position back to mark;
```



### 缓冲区操作
#### 缓冲区分片
在 NIO 中，除了可以分配或者包装一个缓冲区对象外，还可以根据现有的缓冲区对象来创建一个子缓冲区，即在现有缓冲区上切出一片来作为一个新的缓冲区，但现有的缓冲区与创建的子缓冲区在底层数组层面上是数据共享的，也就是说，子缓冲区相当于是现有缓冲区的一个视图窗口。调用 slice()方法可以创建一个子缓冲区。

```java
@Test
public void buffer01() throws Exception {
   ByteBuffer buffer = ByteBuffer.allocate(10);
    for (int i = 0; i < buffer.capacity(); i++) {
        buffer.put((byte) i);
    }

    // 创建子缓冲区
    buffer.position(3);
    buffer.limit(7);
    ByteBuffer slice = buffer.slice();

    // 改变自缓冲区内容
    for (int i = 0; i < slice.capacity(); i++) {
        byte b = slice.get(i);
        slice.put(i, (byte) (b * 10));
    }
    buffer.position(0);
    buffer.limit(buffer.capacity());

//        while (buffer.hasRemaining()) {
    while (buffer.remaining() > 0) {
        System.out.println(buffer.get());
    }
}
```

#### 只读缓冲区
只读缓冲区非常简单，可以读取它们，但是不能向它们写入数据。可以通过调用缓冲区的 asReadOnlyBuffer()方法，将任何常规缓冲区转换为只读缓冲区，这个方法返回一个与原缓冲区完全相同的缓冲区，并与原缓冲区共享数据，只不过它是只读的。如果原缓冲区的内容发生了变化，只读缓冲区的内容也随之发生变化:

```java
@Test
public void buffer02() throws Exception {

// 创建Buffer
ByteBuffer buffer = ByteBuffer.allocate(10);
for (int i = 0; i < buffer.capacity(); i++) {
    buffer.put((byte) i);
}
// 创建只读缓冲区
ByteBuffer readOnlyBuffer = buffer.asReadOnlyBuffer();
for (int i = 0; i < buffer.capacity(); i++) {
    byte b = buffer.get(i);
    buffer.put(i, (byte) (b * 10));
}

readOnlyBuffer.position(0);
readOnlyBuffer.limit(readOnlyBuffer.capacity());
while (readOnlyBuffer.hasRemaining()) {
    System.out.println(readOnlyBuffer.get());
}
}
```

#### 直接缓冲区
直接缓冲区是为加快 I/O 速度，使用一种特殊方式为其分配内存的缓冲区，JDK文档中的描述为:给定一个直接字节缓冲区，Java 虚拟机将尽最大努力直接对它执行本机I/O操作。也就是说，它会在每一次调用底层操作系统的本机 I/O 操作之前(或之后)尝试避免将缓冲区的内容拷贝到一个中间缓冲区中 或者从一个中间缓冲区中拷贝数据。要分配直接缓冲区，需要调用 allocateDirect()方法，而不是allocate()方法，使用方式与普通缓冲区并无区别。

```java
/**
 * 测试直接缓冲区
 * @throws Exception
 */
@Test
public void buffer03() throws Exception {
String infile = "E:\\桌面\\02.txt";
FileInputStream fin = new FileInputStream(infile);
FileChannel channel = fin.getChannel();

String outfile = "E:\\桌面\\02-copy.txt";
FileOutputStream fout = new FileOutputStream(outfile);
FileChannel outchannel = fout.getChannel();

// 创建Buffer
ByteBuffer buffer = ByteBuffer.allocateDirect(10);
while (true) {
    buffer.clear();
    int read = channel.read(buffer);
    if(read == -1) {
        break;
    }
    buffer.flip();
    outchannel.write(buffer);
}

}
```



#### 内存映射文件I/O
内存映射文件 I/O 是一种读和写文件数据的方法，它可以比常规的基于流或者基于通道的 I/O 快的多。内存映射文件 I/O 是通过使文件中的数据出现为内存数组的内容来完成的，这其初听起来似乎不过就是将整个文件读到内存中，但是事实上并不是这样。一般来说，只有文件中实际读取或者写入的部分才会映射到内存中。

```java
private static final int start = 0;
private static final int end = 1024;
// 内存映射文件IO
@Test
public void buffer04() throws Exception {
RandomAccessFile raf = new RandomAccessFile("E:\\桌面\\02.txt", "rw");
FileChannel channel = raf.getChannel();

MappedByteBuffer mbb = channel.map(FileChannel.MapMode.READ_WRITE, start, end);

mbb.put(0, (byte) 'A');
mbb.put(1023, (byte) 'B');
channel.close();

}
```

## NIO (Selector选择器)
### Selector简介
#### Selector和Channel的关系
Selector 一般称为选择器 ，也可以翻译为多路复用器 。它是 Java NIO 核心组件中的一个，用于检查一个或多个 NIO Channel(通道)的状态是否处于可读、可写。如此可以实现单线程管理多个 channels,也就是可以管理多个网络链接。

![画板](https://cdn.nlark.com/yuque/0/2024/jpeg/21718311/1723800428245-a914ffc0-ad37-4b1e-a3dd-9d9c23c9b2d9.jpeg)

使用 Selector 的好处在于: 使用更少的线程来就可以来处理通道了， 相比使用多个线程，避免了线程上下文切换带来的开销。



#### 可选择通道（SelectableChannel）
(1)不是所有的 Channel都可以被 Selector 复用的。比方说，FileChannel 就不能被选择器复用。判断一个 Channel能被 Selector 复用，有一个前提:判断他是否继承了一个抽象类 SelectableChannel。如果继承了 SelectableChannel，则可以被复用，否则不能。

(2)SelectableChannel类提供了实现通道的可选择性所需要的公共方法。它是所有支持就绪检查的通道类的父类。所有 socket通道，都继承了SelectableChannel类都是可选择的，包括从管道(Pipe)对象的中获得的通道。而 FileChannel类，没有继承 SelectableChannel，因此是不是可选通道。

(3)一个通道可以被注册到多个选择器上，但对每个选择器而言只能被注册一次。通道和选择器之间的关系，使用注册的方式完成。SelectableChannel可以被注册到Selector 对象上，在注册的时候，需要指定通道的哪些操作，是 Selector 感兴趣的。

![画板](https://cdn.nlark.com/yuque/0/2024/jpeg/21718311/1723800703278-004e47eb-8934-4024-ba81-ebe135fec98c.jpeg)



#### Channel注册到Selector
(1)使用Channel.register(Selector sel，int ops)方法，将一个通道注册到一个选择器时。第一个参数，指定通道要注册的选择器。第二个参数指定选择器需要查询的通道操作。

(2)可以供选择器查询的通道操作，从类型来分，包括以下四种:

+ 可读:SelectionKey.OP_READ.
+ 可写:SelectionKey.OP_WRITE
+ 连接:SelectionKeyOP_CONNECT
+ 接收:SelectionKey.OP_ACCEPT

如果 Selector 对通道的多操作类型感兴趣，可以用“位或”操作符来实现比如:

```java
int key= SelectionKey.OP_READ  | SelectionKey.OP_WRITE ;
```

(3)选择器查询的不是通道的操作，而是通道的某个操作的一种就绪状态。

什么是操作的就绪状态?一旦通道具备完成某个操作的条件，表示该通道的某个操作已经就绪，就可以被 Selector 查询到，程序可以对通道进行对应的操作。

比方说，某个SocketChannel通道可以连接到一个服务器，则处于“连接就绪”(OP_CONNECT)。

再比方说，一个ServerSocketChannel服务器通道准备好接收新进入的连接，则处于“接收就绪”(OP_ACCEPT)状态。

还比方说，一个有数据可读的通道，可以说是“读就绪”(OP_READ)。一个等待写数据的通道可以说是“写就绪”(OP_WRITE)。

#### 选择键（SelectionKey）
(1)Channel注册到后，并且一旦通道处于某种就绪的状态，就可以被选择器查询到。这个工作，使用选择器Selector的select()方法完成。select方法的作用，对感兴趣的通道操作，进行就绪状态的查询。

(2)Selector 可以不断的査询 Channel 中发生的操作的就绪状态。并且挑选感兴趣的操作就绪状态。一旦通道有操作的就绪状态达成，并且是Selector感兴趣的操作就会被 Selector选中，放入选择键集合中。

(3)一个选择键，首先是包含了注册在 Selector 的通道操作的类型，比方说SelectionKey.OP_READ。也包含了特定的通道与特定的选择器之间的注册关系。



开发应用程序是，选择键是编程的关键。NIO 的编程，就是根据对应的选择键，进行不同的业务逻辑处理。

### Selector使用方法
#### Selector的创建
通过调用Selector.open()方法创建一个Selector对象，如下：

```java
// 1. 获取Selector选择器
Selector selector = Selector.open();
```

#### 注册Channel到Selector中
要实现Selector管理Channel，需要将channel注册到相应的Selector上

```java
// 创建选择器
Selector selector = Selector.open();

// 创建通道
ServerSocketChannel serverSocketChannel = ServerSocketChannel.open();
// 设置模式为非阻塞
serverSocketChannel.configureBlocking(false);

//绑定连接
serverSocketChannel.bind(new InetSocketAddress(9999));

// 将通道注册到选择器上 监听事件为 接受事件
serverSocketChannel.register(selector, SelectionKey.OP_ACCEPT);
```

上面通过调用通道的 register()方法会将它注册到一个选择器上。

首先需要注意的是:“

(1)与 Selector 一起使用时，Channel必须处于非阻塞模式下，否则将抛出异常IllegalBlockingModeException。这意味着，FileChannel不能与Selector 一起使用，因为 FileChannel不能切换到非阻塞模式，而套接字相关的所有的通道都可以。

(2)一个通道，并没有一定要支持所有的四种操作。比如服务器通道ServerSocketChannel支持 Accept 接受操作，而 ocketChannel,客户端通道则不支持。可以通过通道上的 validOps()方法，来获取特定通道下所有支持的操作集合。“

#### 轮询查询就绪操作
(1)通过 Selector的select()方法，可以查询出已经就绪的通道操作，这些就绪的状态集合，包存在一个元素是 selectionKey.对象的 Set 集合中。

(2)下面是Selector几个重载的査询 select()方法:

+ select():阻塞到至少有一个通道在你注册的事件上就绪了。
+ select(long timeout):和 select()一样，但最长阻塞事件为 timeout 毫秒。
+ selectNow():非阻塞，只要有通道就绪就立刻返回。

select()方法返回的 int 值，表示有多少通道已经就绪，更准确的说，是自前一次 select方法以来到这一次 select方法之间的时间段上，有多少通道变成就绪状态。

例如:首次调用 select()方法，如果有一个通道变成就绪状态，返回了1，若再次调用select()方法，如果另一个通道就绪了，它会再次返回1。如果对第一个就绪的channel没有做任何操作，现在就有两个就绪的通道，但在每次select()方法调用之间，只有一个通道就绪了。

一旦调用 select()方法，并且返回值不为0时，在 Selector 中有一个selectedKeys()方法，用来访问已选择键集合，迭代集合的每一个选择键元素，根据就绪操作的类型,完成对应的操作：

```java
public static void main(String[] args) throws Exception {
    // 创建选择器
    Selector selector = Selector.open();

    // 创建通道
    ServerSocketChannel serverSocketChannel = ServerSocketChannel.open();
    // 设置模式为非阻塞
    serverSocketChannel.configureBlocking(false);

    //绑定连接
    serverSocketChannel.bind(new InetSocketAddress(9999));

    // 将通道注册到选择器上 监听事件为 接受事件
    serverSocketChannel.register(selector, SelectionKey.OP_ACCEPT);

    // 查询已经就绪的通道操作
    Set<SelectionKey> selectionKeys = selector.selectedKeys();
    // 遍历集合
    Iterator<SelectionKey> iterator = selectionKeys.iterator();
    while (iterator.hasNext()) {
        SelectionKey selectionKey = iterator.next();
        // 判断是否是接受事件
        if (selectionKey.isAcceptable()) {
            System.out.println("有客户端连接");
        }else if(selectionKey.isConnectable()){
            System.out.println("连接成功");
        }else if(selectionKey.isReadable()){
            System.out.println("有数据可读");
        }else if(selectionKey.isWritable()){
            System.out.println("有数据可写");
        }
        iterator.remove();
    }
}
```



#### 停止选择的方法
选择器执行选择的过程，系统底层会依次询问每个通道是否已经就绪，这个过程可能会造成调用线程进入阻塞状态,那么我们有以下三种方式可以唤醒在 select()方法中阻塞的线程。

wakewp()方法:通过调用 Selector对象的 wakeup()方法让处在阻塞状态的select()方法立刻返回

该方法使得选择器上的第一个还没有返回的选择操作立即返回。如果当前没有进行中的选择操作，那么下一次对 select()方法的一次调用将立即返回。

close()方法:通过 close()方法关闭 Selector，该方法使得任何一个在选择操作中阻塞的线程都被唤醒(类似 wakeup())，同时使得注册到该 Selector 的所有 Channel被注销，所有的键将被取消，但是 Channel本身并不会关闭。



### 示例代码
#### 服务端代码
```java
// 服务器端代码
@Test
public void serverDemo() throws Exception {
// 1.获取服务端通道，绑定端口号
ServerSocketChannel serverSocketChannel = ServerSocketChannel.open();

// 2.切换到非阻塞模式
serverSocketChannel.configureBlocking(false);

// 3. 创建buffer
ByteBuffer serverByteBuffer = ByteBuffer.allocate(1024);

// 4.绑定端口号
serverSocketChannel.bind(new InetSocketAddress(8080));

// 5.创建选择器
Selector selector = Selector.open();

// 6.将通道注册到选择器上，并指定监听的事件类型为读事件
serverSocketChannel.register(selector, SelectionKey.OP_ACCEPT);

// 7.选择器轮询监听，进行后续操作
while (selector.select() > 0) {
    Set<SelectionKey> selectionKeys = selector.selectedKeys();
    Iterator<SelectionKey> iterator = selectionKeys.iterator();
    while (iterator.hasNext()) {
        // 8. 获取当前就绪操作
        SelectionKey next = iterator.next();
        // 9.判断当前操作属于那种
        if (next.isAcceptable()) {
            // 10.获取客户端通道，并切换到非阻塞模式
            SocketChannel socketChannel = serverSocketChannel.accept();
            socketChannel.configureBlocking(false);
            // 11.将通道注册到选择器上，并指定监听的事件类型为读事件
            socketChannel.register(selector, SelectionKey.OP_READ);
        } else if (next.isReadable()) {
            // 12.获取当前通道
            SocketChannel socketChannel = (SocketChannel) next.channel();
            // 13.读取数据到buffer中
            ByteBuffer byteBuffer = ByteBuffer.allocate(1024);
            // 读取数据
            int length = 0;
            while((length = socketChannel.read(byteBuffer)) > 0){
                byteBuffer.flip();
                System.out.println(new String(byteBuffer.array(), 0,length));
                byteBuffer.clear();
            }
            int read = socketChannel.read(serverByteBuffer);

        }
        iterator.remove();
    }
}
}
```

#### 客户端代码
```java
// 客户端代码
@Test
public void clientDemo() throws Exception {
    // 1. 获取通道，绑定主机和端口号
    SocketChannel socketChannel = SocketChannel.open(new InetSocketAddress("127.0.0.1", 8080));
    // 2.切换到非阻塞模式
    socketChannel.configureBlocking(false);
    // 3.创建buffer
    ByteBuffer buffer = ByteBuffer.allocate(1024);
    // 4.向buffer中写数据
    buffer.put(new Date().toString().getBytes());
    // 5.读写模式切换
    buffer.flip();
    // 6.将buffer中的数据发送到服务端
    socketChannel.write(buffer);
    // 7.关闭
    buffer.clear();
}
```

客户端优化,循环输出

```java
    public static void main(String[] args) throws Exception {
        // 1. 获取通道，绑定主机和端口号
        SocketChannel socketChannel = SocketChannel.open(new InetSocketAddress("127.0.0.1", 8080));
        // 2.切换到非阻塞模式
        socketChannel.configureBlocking(false);
        // 3.创建buffer
        ByteBuffer buffer = ByteBuffer.allocate(1024);
        Scanner scanner = new Scanner(System.in);
        while (scanner.hasNext()) {
            String next = scanner.next();
            // 4.向buffer中写数据
            buffer.put((new Date().toString() + "--->" + next).getBytes());
            // 5.读写模式切换
            buffer.flip();
            // 6.将buffer中的数据发送到服务端
            socketChannel.write(buffer);
            // 7.buffer
            buffer.clear();
        }
    }
```



#### 总结
+ 第一步 创建ServerSocketChannel通道，绑定监听端口
+ 第二步 设置通道是非阻塞模式
+ 第三步 创建Selector选择器
+ 第四步 把Channel注册到Selector选择器上，监听连接事件
+ 第五步 调用Selector的select方法（循环调用），监测通道的就绪状态
+ 第六步 调用selectKeys方法获取就绪channel集合
+ 第七步 遍历就绪集channel集合，判断就绪事件类型，实现具体业务的操作
+ 第八步 根据业务，是否需要再次注册监听事件，重复执行

## NIO (Pipe 和 FileLock)
### Pipe管道
Java NIO 管道是 2个线程之间的单向数据连接。Pipe 有一个 source 通道和一个sink 通道。数据会被写到 sink 通道，从 source 通道读取。

![画板](https://cdn.nlark.com/yuque/0/2024/jpeg/21718311/1723809296178-25134a7a-bdc8-443e-92eb-9b1121a42200.jpeg)

#### 创建管道
通过Pipe.open()方法创建管道：

```java
// 1. 创建管道
Pipe pipe = Pipe.open();
```

#### 写入管道
通过获取到pipe.sink()方法获取到sinkChannel

```java
// 1. 创建管道
Pipe pipe = Pipe.open();
// 2. 获取Sink通道
Pipe.SinkChannel sinkChannel = pipe.sink();
// 3. 创建缓冲区
ByteBuffer byteBuffer = ByteBuffer.allocate(1024);
byteBuffer.put("hello".getBytes());
byteBuffer.flip();

// 4. 写入数据
sinkChannel.write(byteBuffer);
```

#### 从管道读取数据
```java
// 5. 获取Source通道
Pipe.SourceChannel sourceChannel = pipe.source();
// 6. 创建缓冲区，读取数据
//        ByteBuffer byteBuffer2 = ByteBuffer.allocate(1024);
byteBuffer.flip();
int length = sourceChannel.read(byteBuffer);
System.out.println(new String(byteBuffer.array(), 0, length));
 // 7. 关闭管道
sinkChannel.close();
sourceChannel.close();
```

#### 示例
```java
public class PipeDemo {
    public static void main(String[] args) throws Exception {
        // 1. 创建管道
        Pipe pipe = Pipe.open();
        // 2. 获取Sink通道
        Pipe.SinkChannel sinkChannel = pipe.sink();
        // 3. 创建缓冲区
        ByteBuffer byteBuffer = ByteBuffer.allocate(1024);
        byteBuffer.put("hello".getBytes());
        byteBuffer.flip();

        // 4. 写入数据
        sinkChannel.write(byteBuffer);

        // 5. 获取Source通道
        Pipe.SourceChannel sourceChannel = pipe.source();
        // 6. 创建缓冲区，读取数据
        //        ByteBuffer byteBuffer2 = ByteBuffer.allocate(1024);
        byteBuffer.flip();
        int length = sourceChannel.read(byteBuffer);
        System.out.println(new String(byteBuffer.array(), 0, length));

        // 7. 关闭管道
        sinkChannel.close();
        sourceChannel.close();
    }
}
```

### FileLock
#### FileLock简介
文件锁在 OS 中很常见，如果多个程序同时访问、修改同一个文件，很容易因为文件数据不同步而出现问题。给文件加一个锁，同一时间，只能有一个程序修改此文件或者程序都只能读此文件，这就解决了同步问题。

文件锁是进程级别的，不是线程级别的。文件锁可以解决多个进程并发访问、修改同一个文件的问题，但不能解决多线程并发访问、修改同一文件的问题。使用文件锁时，同一进程内的多个线程，可以同时访问、修改此文件。

文件锁是当前程序所属的 JVM 实例持有的，一旦获取到文件锁(对文件加锁)，要调用 release()，或者关闭对应的 FileChannel 对象，或者当前 JM 退出，才会释放这个锁。

一旦某个进程(比如说 JVM 实例)对某个文件加锁，则在释放这个锁之前，此进程不能再对此文件加锁，就是说 JM 实例在同一文件上的文件锁是不重看的(进程级别不能重复在同一文件上获取锁)。



#### 文件锁分类
排它锁:又叫独占锁。对文件加排它锁后，该进程可以对此文件进行读写，该进程独占此文件，其他进程不能读写此文件，直到该进程释放文件锁。

共享锁:某个进程对文件加共享锁，其他进程也可以访问此文件，但这些进程都只能读此文件，不能写。线程是安全的。只要还有一个进程持有共享锁，此文件就只能读，不能写。

#### 使用示例
```java
FileChannel fileChannel = new FileOutputStream("./1.txt").getChannel();
// 加锁
FileLock lock = fileChannel.lock();
// ...
//对文件进行一些操作
lock.release();
```

 文件锁要通过FileChannel使用

#### 获取文件锁方法
有 4 种获取文件锁的方法:

+ lock()  //对整个文件加锁，默认为排它锁。
+ lock(long position,long size,booean shared) //自定义加锁方式。前2个参数指定要加锁的部分(可以只对此文件的部分内容加锁)，第三个参数值指定是否是共享锁。
+ tryLock()//对整个文件加锁，默认为排它锁。
+ tryLock(long position,long size,booean shared) //自定义加锁方式。

如果指定为共享锁，则其它进程可读此文件，所有进程均不能写此文件，如果某进程试图对此文件进行写操作，会抛出异常。

#### lock与tryLock的区别
lock 是阻塞式的，如果未获取到文件锁，会一直阻塞当前线程，直到获取文件锁

tryLock和lock 的作用相词，只不过 tryLock是非阻塞式的，tryLock 是尝试获取文件锁，获取成功就返回锁对象，否则返回 null，不会阻塞当前线程。

#### FileLock的两个方法
boolean isShared()//此文件锁是否是共享锁

boolean isValid() //此文件锁是否还有效

在某些 OS 上，对某个文件加锁后，不能对此文件使用通道映射。

#### 完整例子
```java
public class FileLockDemo {
    public static void main(String[] args) throws Exception {
        String input = "hello";
        System.out.println("input: " + input);

        ByteBuffer buffer = ByteBuffer.wrap(input.getBytes());

        String filePath = "E:\\桌面\\01.txt";
        Path path = Paths.get(filePath);

        FileChannel channel = FileChannel.open(path, StandardOpenOption.WRITE,StandardOpenOption.APPEND);
        channel.position(channel.size()-1);

        // 加锁
        //        FileLock lock = channel.lock(0, Long.MAX_VALUE, true);
        FileLock lock = channel.lock();

        System.out.println("是否是共享锁: " + lock.isShared());
        channel.write(buffer);

        channel.close();

        // 读文件

        readFile(filePath);
    }

    private static void readFile(String filePath) throws Exception {
        FileReader reader = new FileReader(filePath);
        BufferedReader bufferedReader = new BufferedReader(reader);
        String s = bufferedReader.readLine();
        System.out.println("读取到的内容: " + s + "\t");
        while (s != null) {
            System.out.println(s);
            s = bufferedReader.readLine();
        }
        reader.close();
        bufferedReader.close();

    }
}
```

## 其他
### Path
#### Path简介
Java Path 接口是Java NIO 更新的一部分，同 Java NIO 一起已经包括在 Java6 和Java7 中。Java Path 接口是在Java7 中添加到 Java NIO 的。Path 接口位于java.nio.file 包中，所以 Path 接口的完全限定名称为java.nio.file.Path。

Java Path 实例表示文件系统中的路径。一个路径可以指向一个文件或一个目录。路径可以是绝对路径，也可以是相对路径。绝对路径包含从文件系统的根目录到它指向的文件或目录的完整路径。相对路径包含相对于其他路径的文件或目录的路径。

在许多方面，java.nio.file.Path 接口类似于java.io.File 类，但是有一些差别。不过在许多情况下，可以使用 Path 接口来替换 File 类的使用。

#### 创建Path实例
使用 java.nio.file.Path 实例必须创建一个 Path 实例。可以使用 Paths 类(java.nio.file.Paths)中的静态方法 Paths.get()来创建路径实例。

```java
import java.nio.file.Path;
import java.nio.file.Paths;
public class PathDemo {
    public static void main(String args) {
        Path path = Paths.get("d:\01.txt");
    }
}
```

上述代码，可以理解为，Paths.get()方法是 Path 实例的工厂方法。

#### 创建绝对路径
(1)创建绝对路径，通过调用 Paths.get()方法，给定绝对路径文件作为参数来完成。

示例代码

```java
Path path = Paths.get("d:\01.txt");
```

上述代码中，绝对路径是 d:\atguigu\001.txt。在Java字符串中，\是一个转义字符，需要编写\，告诉 Java 编译器在字符串中写入一个\字符。

(2)如果在 Linux、MacOS 等操作字体上，上面的绝对路径可能如下:

```java
Path path = Paths.get("/home/jakobjenkov/myfile.txt");
```

绝对路径现在为/home/jakobjenkov/myfile.txt.

(3)如果在 Windows 机器上使用了从/开始的路径，那么路径将被解释为相对于当前驱动器。

#### 创建相对路径
Java NIO Path 类也可以用于处理相对路径。您可以使用 Paths.get(basePathrelativePath)方法创建一个相对路径。

示例代码

```java
Path projects = Paths.get("d:\\latguigu","projects");
Path file = Paths.get("d:\\latguigu","projects\\002.txt");
```

代码1创建了一个 Java Path 的实例，指向路径(目录):d:\atguigu\projects

代码 2 创建了一个 Path 的实例，指向路径(文件):d:\atguigu\projects\002.txt

#### Path.normalize()
Path 接口的 normalize()方法可以使路径标准化。标准化意味着它将移除所有在路径字符串的中间的.和..代码，并解析路径字符串所引用的路径。

```plain
// normalize() 规范化路径
String orignalPath = "E:\\桌面\\projects\\..\\002.txt";
Path path1 = Paths.get(orignalPath);
System.out.println("path1 = " + path1);

//标准化的路径不包含projects\\
Path normalize = path1.normalize();
System.out.println("normalize = " + normalize);
```

输出结果：标准化的路径不包含projects\\

### Files
Java NIO Files 类(java.nio.file.Files)提供了几种操作文件系统中的文件的方法。以下内容介绍 Java NlO Files 最常用的一些方法。java.nio.file.Files 类与java.nio.file.Path 实例一起工作，因此在学习 Files 类之前，需要先了解 Path 类。

#### Files.createDirectory()
Files.createDirectory()方法，用于根据 Path 实例创建一个新目录

```java
Path path = Paths.get("e:\\桌面\\test");
try {
    Path directory = Files.createDirectory(path);
} catch (IOException e) {
    throw new RuntimeException(e);
}
```

第一行创建表示要创建的目录的 Path 实例。在 try-catch 块中，用路径作为参数调用Files.createDirectory()方法。如果创建目录成功，将返回一个 Path 实例，该实例指向新创建的路径。

如果该目录已经存在，则是抛出一个java.nio.file.FileAlreadyExistsException。如果出现其他错误，可能会抛出IOException。例如，如果想要的新目录的父目录不存在，则可能会抛出 IOException。



#### Files.copy()
(1)从source copy target

```java
// copy
Path source = Paths.get("e:\\桌面\\01.txt");
Path target = Paths.get("e:\\桌面\\test\\002.txt");
try {
    Files.copy(source, target);
} catch (IOException e) {
    throw new RuntimeException(e);
}
```

首先，该示例创建两个 Path 实例。然后，这个例子调用 Files.copy()，将两个 Path实例作为参数传递。这可以让源路径引用的文件被复制到目标路径引用的文件中。“如果目标文件已经存在，则抛出一个java.nio.file.FileAlreadyExistsException 异常如果有其他错误，则会抛出一个IOException。例如，如果将该文件复制到不存在的目录，则会抛出IOException。

(2)覆盖已存在的文件

Files.copy()方法的第三个参数。如果目标文件已经存在，这个参数指示 copy()方法覆盖现有的文件。

```java
Files.copy(source, target, StandardCopyOption.REPLACE_EXISTING);
```



#### Files.move()
Files.move()用于将文件从一个路径移动到另一个路径。移动文件与重命名相同，但是移动文件既可以移动到不同的目录，也可以在相同的操作中更改它的名称。

示例：

```java
// move
Path source = Paths.get("e:\\桌面\\01.txt");
Path target = Paths.get("e:\\桌面\\01test.txt");
try {
    Files.move(source, target);
} catch (IOException e) {
    throw new RuntimeException(e);
}
```



#### Files.delete()
```java
//delete
Path path = Paths.get("e:\\桌面\\01test.txt");
try {
    Files.delete(path);
} catch (IOException e) {
    // 删除文件失败
    e.printStackTrace();
}
```

创建指向要删除的文件的 Path。然后调用 Files.delete()方法。如果 Files.delete()不能删除文件(例如，文件或目录不存在)，会抛出一个IOException。

#### Files.walkFileTree()
(1)Files.walkFileTree()方法包含递归遍历目录树功能，将 Path 实例和 FileVisitor作为参数。Path 实例指向要遍历的目录，FileVisitor 在遍历期间被调用。

(2)FileVisitor是一个接口，必须自己实现 FileVisitor接口，并将实现的实例传递给walkFileTree()方法。在目录遍历过程中，您的 FileVisitor 实现的每个方法都将被调用。如果不需要实现所有这些方法，那么可以扩展 SimpleFileVisitor 类，它包含FileVisitor接口中所有方法的默认实现。

(3)FileVisitor接口的方法中，每个都返回一个 FileVisitResult 枚举实例。FileVisitResult 枚举包含以下四个选项:

CONTINUE 继续

TERMINATE 终止

SKIP SIBLING 跳过同级

SKIP SUBTREE 跳过子级

```java
 Path rootPath = Paths.get("e:\\桌面\\test");
        String fileToFind = File.separator + "002.txt";

        try {
            Files.walkFileTree(rootPath, new SimpleFileVisitor<Path>() {
                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs)  {
                    String fileString = file.toAbsolutePath().toString();
                    if(fileString.endsWith(fileToFind)){
                        System.out.println("找到文件：" + file);
                        return FileVisitResult.TERMINATE;
                    }
                    return FileVisitResult.CONTINUE;
                }
            });
        } catch (IOException e) {
            throw new RuntimeException(e);
        }

```

### AsynchronousFileChannel
在Java 7中，Java NIO 中添加了AsynchronousFileChannel，也就是是异步地将数据写入文件。

#### 创建AsynchronousFileChannel
通过静态方法open（）创建：

```java
public class Demo   {
    public static void main(String[] args) {
        Path path = Paths.get("e:\\桌面\\02.txt");
        try {
            AsynchronousFileChannel asynchronousFileChannel = AsynchronousFileChannel.open(path, StandardOpenOption.READ);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }
}
```

open()方法的第一个参数指向与 AsynchronousFileChannel相关联文件的 Path 实例。

第二个参数是一个或多个打开选项，它告诉 AsynchronousFileChannel在文件上执行什么操作。在本例中，我们使用了 StandardOpenOption.READ 选项，表示该文件将被打开阅读。

#### 通过Futrue读取数据
可以通过两种方式从 AsynchronousFileChannel读取数据。第一种方式是调用返回Future 的read()方法：

```java
@Test
public void readAsyncFileChannelFutrue() throws Exception {
    // 1. 创建一个异步文件通道
    Path path = Paths.get("e:\\桌面\\02.txt");
    AsynchronousFileChannel asynchronousFileChannel = AsynchronousFileChannel.open(path, StandardOpenOption.READ);

    // 2.创建Buffer
    ByteBuffer buffer = ByteBuffer.allocate(1024);

    // 3. 调用channel的read方法得到Future
    Future<Integer> future = asynchronousFileChannel.read(buffer, 0);

    // 4. 判断是否完成 isDone,true完成，false未完成
    while (!future.isDone()) {
        System.out.println("等待中...");
    }

    // 5. 读取数据到buffer中
    buffer.flip();
    //        while (buffer.hasRemaining()) {
    //            System.out.println(buffer.get());
    //        }
    byte[] bytes = new byte[buffer.limit()];
    buffer.get(bytes);
    System.out.println(new String(bytes));
    buffer.clear();

}
```



(1)创建了一个AsynchronousFileChannel

(2)创建一个 ByteBuffer，它被传递给read()方法作为参数，以及一个0的位置

(3)在调用read()之后，循环，直到返回的isDone()方法返回 true。读取操作完成后，数据读取到 ByteBuffer中，然后打印到System.out 中。

#### CompletionHandler读取数据
第二种方法是调用 read()方法，该方法将一个CompletionHandler 作为参数

```java
@Test
public void readAsyncFileChannelComplete() throws Exception {
    // 1. 创建一个异步文件通道
    Path path = Paths.get("e:\\桌面\\02.txt");
    AsynchronousFileChannel asynchronousFileChannel = AsynchronousFileChannel.open(path, StandardOpenOption.READ);

    // 2.创建Buffer
    ByteBuffer buffer = ByteBuffer.allocate(1024);

    // 3. 调用channel
    asynchronousFileChannel.read(buffer, 0, buffer, new CompletionHandler<Integer, ByteBuffer>() {
        @Override
        public void completed(Integer result, ByteBuffer attachment) {
            System.out.println("result"+result);
            // 5. 读取数据到buffer中
            attachment.flip();
            byte[] bytes = new byte[attachment.limit()];
            attachment.get(bytes);
            System.out.println(new String(bytes));
            attachment.clear();
        }

        @Override
        public void failed(Throwable exc, ByteBuffer attachment) {

        }
    });
}
```

#### 通过Futrue写数据
```java
@Test
public void writeAsyncFileChannelFutrue() throws Exception {
// 1. 创建一个异步文件通道
Path path = Paths.get("e:\\桌面\\02.txt");
AsynchronousFileChannel asynchronousFileChannel = AsynchronousFileChannel.open(path, StandardOpenOption.WRITE);
// 2.创建Buffer
ByteBuffer buffer = ByteBuffer.allocate(1024);
buffer.put("hello".getBytes());
buffer.flip();
// 3. 调用channel
Future<Integer> future = asynchronousFileChannel.write(buffer, 0);
while (!future.isDone()) {
    System.out.println("等待中...");
}
buffer.clear();
System.out.println("写入成功");
}
```

首先，Asynchronousri1annel以写模式打开。然后创建一个 ByteBuffer,并将些数据写入其中。然后，ByteBuffer中的数据被写入到文件中。最后，示例检查返回的 Future，以查看写操作完成时的情况。

注意，文件必须已经存在。如果该文件不存在，那么write()方法将抛出一个java.nio file.NoSuchFileException。

#### 通过CompletionHandler写数据
```java
@Test
public void writeAsyncFileChannelComplete() throws Exception {
// 1. 创建一个异步文件通道
Path path = Paths.get("e:\\桌面\\02.txt");
AsynchronousFileChannel asynchronousFileChannel = AsynchronousFileChannel.open(path, StandardOpenOption.WRITE);
// 2.创建Buffer
ByteBuffer buffer = ByteBuffer.allocate(1024);
buffer.put("hellojava".getBytes());
buffer.flip();
// 3. 调用channel
asynchronousFileChannel.write(buffer, 0,  buffer, new CompletionHandler<Integer, Object>() {
    @Override
    public void completed(Integer result, Object attachment) {
        System.out.println("result"+result);

    }

    @Override
    public void failed(Throwable exc, Object attachment) {

    }
});
buffer.clear();
System.out.println("写入成功");
}
```

当写操作完成时，将会调用 CompletionHandler的completed()方法。如果写失败，则会调用 failed（）方法。



### 字符集Charset
java 中使用 Charset 来表示字符集编码对象

Charset 常用静态方法

```java
public static Charset forName(String charsetName)//通过编码类型获得 Charset 对象
public static SortedMap<String,Charset> availableCharsets()//获得系统支持的所有编码方式
public static Charset defaultCharset()//获得虚拟机默认的编码方式
public static boolean issuoported(String charsetName)//判断是否支持该编码类型
```

Charset 常用普通方法

```java
public final String name()//获得 Charset 对象的编码类型(String)
public abstract CharsetEncoder newEncoder()//获得编码器对象
public abstract CharsetDecoder newDecoder()//获得解码器对象
```



```java
public class CharsetDemo {

    public static void main(String[] args) throws CharacterCodingException {
        // 1. 获取Charset对象
        Charset charset = Charset.forName("UTF-8");
        // 2. 获取编码器
        CharsetEncoder charsetEncoder = charset.newEncoder();
        // 3. 创建缓冲区
        CharBuffer charBuffer = CharBuffer.allocate(1024);
        charBuffer.put("你好");
        charBuffer.flip();
        // 4. 编码
        ByteBuffer encode = charsetEncoder.encode(charBuffer);
        System.out.println("编码之后结果:");
        for (int i = 0; i < encode.limit(); i++) {
            System.out.println(encode.get());
        }
        // 5. 获取解码器
        encode.flip();
        CharsetDecoder charsetDecoder = charset.newDecoder();

        // 6. 解码
        CharBuffer decode = charsetDecoder.decode(encode);
        System.out.println("解码之后结果:"+decode.toString());

        // 7. 使用GBK解码
        CharsetDecoder charsetDecoder1 = Charset.forName("GBK").newDecoder();
        CharBuffer decode1 = charsetDecoder1.decode(encode);
        System.out.println("使用GBK解码之后结果:"+decode1.toString());

        // 8. 获取Charset支持的所有字符集
        Map<String, Charset> map = Charset.availableCharsets();
        Set<Map.Entry<String, Charset>> entries = map.entrySet();
        for (Map.Entry<String, Charset> entry : entries) {
            System.out.println(entry.getKey()+"="+entry.getValue());
        }
    }
}
```



## 聊天室案例
服务端

```java
package com.sxq.chat.server;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.ByteBuffer;
import java.nio.channels.*;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.Set;

/**
 * @author song
 * @version 1.0
 * @date 2024/8/18 15:58
 * @description: 服务端
 */

public class ChatServer {
    // 服务端启动方法
    public void start() throws IOException {
        // 创建Selector选择器
        Selector selector = Selector.open();
        // 创建ServerSocketChannel
        ServerSocketChannel serverSocketChannel = ServerSocketChannel.open();
        // channel绑定端口
        serverSocketChannel.bind(new InetSocketAddress(8000));
        // 设置为非阻塞模式
        serverSocketChannel.configureBlocking(false);
        // 将channel注册到selector
        serverSocketChannel.register(selector, SelectionKey.OP_ACCEPT);
        System.out.println("服务端启动成功");
        // 循环监听客户端连接，等待新连接
        for (; ; ) {
            // 获取channel数量
            int select = selector.select();
            if (select == 0) {
                continue;
            }
            // 获取可用的channel
            Set<SelectionKey> selectionKeys = selector.selectedKeys();
            Iterator<SelectionKey> iterator = selectionKeys.iterator();
            while (iterator.hasNext()) {
                SelectionKey selectionKey = iterator.next();
                // 移除当前key
                iterator.remove();
                // 判断是否是accept状态
                if (selectionKey.isAcceptable()) {
                    acceptOperation(serverSocketChannel, selector);
                    // 判断是否是可读状态
                } else if (selectionKey.isReadable()) {
                    readOperation(selector, selectionKey);
                    // 判断是否是可写状态
                }
            }
        }
        // 根据就绪状态，调用对应方法的具体业务操作
        // accept
        // read
        // write
        // close
    }

    private void readOperation(Selector selector, SelectionKey selectionKey) throws IOException {
        // 从selector中获取channel
        SocketChannel socketChannel = (SocketChannel) selectionKey.channel();
        // 创建Buffer
        ByteBuffer buffer = ByteBuffer.allocate(1024);

        // 循环读取客户端消息
        int readLength = socketChannel.read(buffer);
        String message = "";
        if (readLength > 0) {
            // 切换成读模式
            buffer.flip();
            // 获取客户端发送的消息
            message += StandardCharsets.UTF_8.decode(buffer);

            // 将channel再次注册到selector，监听可读事件
            socketChannel.register(selector, SelectionKey.OP_READ);

            // 把客户端消息发送消息，广播到其他客户端
            if(message.length()>0) {
//                System.out.println(message);
                castOtherClient(message, selector,socketChannel);
            }
        }
    }

    // 广播消息
    private void castOtherClient(String message, Selector selector, SocketChannel socketChannel) {
        // 获取所有注册到selector的channel
        Set<SelectionKey> selectionKeys = selector.keys();
        // 循环向所有channel发送消息
        for (SelectionKey key : selectionKeys) {
            // 获取channel
            Channel tarChannel =  key.channel();
            if(tarChannel instanceof SocketChannel && socketChannel != tarChannel){
                try {
                    // 获取channel
                    SocketChannel tarSocketChannel = (SocketChannel) tarChannel;
                    // 将消息发送给其他客户端
                    tarSocketChannel.write(StandardCharsets.UTF_8.encode("[" + socketChannel.getRemoteAddress() + "]" + message));
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }
    }

    private void acceptOperation(ServerSocketChannel serverSocketChannel, Selector selector) throws IOException {
        // 1 接入状态，创建socketChannel
        SocketChannel socketChannel = serverSocketChannel.accept();
        // 2 将socketChannel设置为非阻塞模式
        socketChannel.configureBlocking(false);
        // 3 将socketChannel注册到selector，并设置监听可读事件
        socketChannel.register(selector, SelectionKey.OP_READ);
        // 4 客户端回复信息
        socketChannel.write(StandardCharsets.UTF_8.encode("欢迎你进入聊天室，请注意隐私安全！"));
    }

    public static void main(String[] args) throws IOException {
        new ChatServer().start();

    }
}

```

客户端

```java
package com.sxq.chat.client;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.ByteBuffer;
import java.nio.channels.SelectionKey;
import java.nio.channels.Selector;
import java.nio.channels.SocketChannel;
import java.nio.charset.StandardCharsets;
import java.util.Scanner;

/**
 * @author song
 * @version 1.0
 * @date 2024/8/18 15:59
 * @description: 客户端
 */

public class ChatClient {

    //客户端启动
    public void start(String name) throws IOException {
        // 连接服务端
        SocketChannel socketChannel = SocketChannel.open(new InetSocketAddress("127.0.0.1", 8000));
        // 接收服务端发来的消息
        Selector selector = Selector.open();
        socketChannel.configureBlocking(false);
        socketChannel.register(selector, SelectionKey.OP_READ);
        // 创建线程
        new Thread(new ClientThread(selector)).start();
        // 向服务端发消息
        Scanner scanner = new Scanner(System.in);
        while (scanner.hasNextLine()) {
            String msg = scanner.nextLine();
            if (msg.length() > 0) {

                socketChannel.write(StandardCharsets.UTF_8.encode(name +":"+ msg));
            }
        }



    }

    public static void main(String[] args) throws IOException {
        new ChatClient().start("张三");
    }
}
```

```java
package com.sxq.chat.client;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.SelectionKey;
import java.nio.channels.Selector;
import java.nio.channels.SocketChannel;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.Set;

/**
 * @author song
 * @version 1.0
 * @date 2024/8/18 16:45
 * @description: TODO
 */

public class ClientThread implements Runnable {
    private Selector selector;
    public ClientThread(Selector selector) {
        this.selector = selector;
    }
    @Override
    public void run() {
        // 循环监听客户端连接，等待新连接
        for (; ; ) {
            // 获取channel数量
            int select = 0;
            try {
                select = selector.select();
                if (select == 0) {
                    continue;
                }
                // 获取可用的channel
                Set<SelectionKey> selectionKeys = selector.selectedKeys();
                Iterator<SelectionKey> iterator = selectionKeys.iterator();
                while (iterator.hasNext()) {
                    SelectionKey selectionKey = iterator.next();
                    // 移除当前key
                    iterator.remove();
                    // 判断是否是可读
                    if (selectionKey.isReadable()) {
                        readOperation(selector, selectionKey);
                        // 判断是否是可写状态
                    }
                }
            } catch (IOException e) {
                throw new RuntimeException(e);
            }

        }
    }

    private void readOperation(Selector selector, SelectionKey selectionKey) throws IOException {
        // 从selector中获取channel
        SocketChannel socketChannel = (SocketChannel) selectionKey.channel();
        // 创建Buffer
        ByteBuffer buffer = ByteBuffer.allocate(1024);

        // 循环读取客户端消息
        int readLength = socketChannel.read(buffer);
        String message = "";
        if (readLength > 0) {
            // 切换成读模式
            buffer.flip();
            // 获取客户端发送的消息
            message += StandardCharsets.UTF_8.decode(buffer);

            // 将channel再次注册到selector，监听可读事件
            socketChannel.register(selector, SelectionKey.OP_READ);

            // 把客户端消息发送消息，广播到其他客户端
            if(message.length()>0) {
                System.out.println(message);
                //                castOtherClient(message, selector,socketChannel);
            }
        }
    }
}
```
