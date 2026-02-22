using WhiteboardApp.Hubs;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorPages();
builder.Services.AddSignalR();
builder.Services.AddSingleton<WhiteboardApp.Services.BoardState>();
// Allow local testing from different origins (http/https/ports).
builder.Services.AddCors(options =>
{
    options.AddPolicy("LocalCors", policy =>
    {
        policy.WithOrigins("https://localhost:7157", "http://localhost:7157", "http://localhost:46315")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});


var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseDefaultFiles();   // Looks for index.html
app.UseStaticFiles();
// Enable CORS before SignalR endpoints so browsers on different local origins can connect during testing.
app.UseCors("LocalCors");
app.MapHub<WhiteboardHub>("/whiteboardHub");
app.UseHttpsRedirection();

app.UseRouting();

app.UseAuthorization();

app.MapStaticAssets();
app.MapRazorPages()
   .WithStaticAssets();

app.Run();
